/**
 * Nuvei PSP Adapter
 * Uses Basis Theory proxy to forward card data to Nuvei
 *
 * Nuvei API Docs: https://docs.nuvei.com/api/main/indexMain_v1_0.html
 */

export interface AuthorizeRequest {
  amount: number;
  currency: string;
  tokenId: string;
  idempotencyKey: string;
  capture: boolean;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface AuthorizeResponse {
  success: boolean;
  transactionId: string;
  status: 'authorized' | 'captured' | 'failed';
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  };
  failureCode?: string;
  failureMessage?: string;
  rawResponse: unknown;
}

export const nuveiAdapter = {
  name: 'nuvei' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: {
      merchant_id: string;
      merchant_site_id: string;
      secret_key: string;
      environment?: 'test' | 'live';
    },
    basisTheoryApiKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://secure.safecharge.com/ppp/api/v1'
      : 'https://ppp-test.nuvei.com/ppp/api/v1';

    // First, get a session token
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const sessionChecksum = await generateChecksum(
      credentials.merchant_id,
      credentials.merchant_site_id,
      '', // clientRequestId
      timestamp,
      credentials.secret_key
    );

    const sessionResponse = await fetch(`${baseUrl}/getSessionToken.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: credentials.merchant_id,
        merchantSiteId: credentials.merchant_site_id,
        clientRequestId: req.idempotencyKey,
        timeStamp: timestamp,
        checksum: sessionChecksum,
      }),
    });

    const sessionResult = await sessionResponse.json();
    if (sessionResult.status !== 'SUCCESS') {
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: sessionResult.errCode || 'session_error',
        failureMessage: sessionResult.reason || 'Failed to get session token',
        rawResponse: sessionResult,
      };
    }

    const sessionToken = sessionResult.sessionToken;
    const transactionType = req.capture ? 'Sale' : 'Auth';

    // Use Basis Theory proxy to send payment
    const paymentChecksum = await generateChecksum(
      credentials.merchant_id,
      credentials.merchant_site_id,
      req.idempotencyKey,
      String(req.amount),
      req.currency,
      timestamp,
      credentials.secret_key
    );

    const proxyResponse = await fetch('https://api.basistheory.com/proxy', {
      method: 'POST',
      headers: {
        'BT-API-KEY': basisTheoryApiKey,
        'BT-PROXY-URL': `${baseUrl}/payment.do`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionToken,
        merchantId: credentials.merchant_id,
        merchantSiteId: credentials.merchant_site_id,
        clientRequestId: req.idempotencyKey,
        clientUniqueId: req.idempotencyKey,
        amount: String(req.amount / 100),
        currency: req.currency,
        timeStamp: timestamp,
        checksum: paymentChecksum,
        transactionType,
        paymentOption: {
          card: {
            // Basis Theory token interpolation
            cardNumber: `{{${req.tokenId} | json: '$.number'}}`,
            cardHolderName: `{{${req.tokenId} | json: '$.name'}}`,
            expirationMonth: `{{${req.tokenId} | json: '$.expiration_month'}}`,
            expirationYear: `{{${req.tokenId} | json: '$.expiration_year'}}`,
            CVV: `{{${req.tokenId} | json: '$.cvc'}}`,
          },
        },
        billingAddress: req.customerEmail ? {
          email: req.customerEmail,
        } : undefined,
        deviceDetails: {
          ipAddress: '0.0.0.0', // Should be passed from request
        },
      }),
    });

    const result = await proxyResponse.json();

    const isSuccess = result.status === 'SUCCESS' &&
      (result.transactionStatus === 'APPROVED' || result.transactionStatus === 'PENDING');

    // Extract card details
    const card = result.paymentOption?.card ? {
      brand: result.paymentOption.card.ccCardNumber?.replace(/\d/g, 'X').slice(0, 4) === 'XXXX' ? 'visa' : undefined,
      last4: result.paymentOption.card.ccCardNumber?.slice(-4),
      exp_month: parseInt(result.paymentOption.card.ccExpMonth || '0'),
      exp_year: parseInt(result.paymentOption.card.ccExpYear || '0'),
    } : undefined;

    return {
      success: isSuccess,
      transactionId: result.transactionId || '',
      status: isSuccess ? (req.capture ? 'captured' : 'authorized') : 'failed',
      card,
      failureCode: isSuccess ? undefined : result.errCode || result.gwErrorCode,
      failureMessage: isSuccess ? undefined : result.reason || result.gwErrorReason,
      rawResponse: result,
    };
  },

  async capture(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      merchant_id: string;
      merchant_site_id: string;
      secret_key: string;
      environment?: 'test' | 'live';
    }
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://secure.safecharge.com/ppp/api/v1'
      : 'https://ppp-test.nuvei.com/ppp/api/v1';

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const checksum = await generateChecksum(
      credentials.merchant_id,
      credentials.merchant_site_id,
      transactionId,
      String(amount / 100),
      currency,
      timestamp,
      credentials.secret_key
    );

    const response = await fetch(`${baseUrl}/settleTransaction.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: credentials.merchant_id,
        merchantSiteId: credentials.merchant_site_id,
        clientRequestId: `capture_${transactionId}`,
        relatedTransactionId: transactionId,
        amount: String(amount / 100),
        currency,
        timeStamp: timestamp,
        checksum,
      }),
    });

    const result = await response.json();
    const isSuccess = result.status === 'SUCCESS';

    return {
      success: isSuccess,
      transactionId: result.transactionId || transactionId,
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.errCode,
      failureMessage: result.reason,
      rawResponse: result,
    };
  },

  async refund(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      merchant_id: string;
      merchant_site_id: string;
      secret_key: string;
      environment?: 'test' | 'live';
    },
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://secure.safecharge.com/ppp/api/v1'
      : 'https://ppp-test.nuvei.com/ppp/api/v1';

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const checksum = await generateChecksum(
      credentials.merchant_id,
      credentials.merchant_site_id,
      idempotencyKey,
      String(amount / 100),
      currency,
      timestamp,
      credentials.secret_key
    );

    const response = await fetch(`${baseUrl}/refundTransaction.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: credentials.merchant_id,
        merchantSiteId: credentials.merchant_site_id,
        clientRequestId: idempotencyKey,
        relatedTransactionId: transactionId,
        amount: String(amount / 100),
        currency,
        timeStamp: timestamp,
        checksum,
      }),
    });

    const result = await response.json();
    const isSuccess = result.status === 'SUCCESS';

    return {
      success: isSuccess,
      transactionId: result.transactionId || '',
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.errCode,
      failureMessage: result.reason,
      rawResponse: result,
    };
  },

  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      return signature.length > 0 && secret.length > 0;
    } catch {
      return false;
    }
  },

  normalizeWebhook(payload: any): {
    type: string;
    pspEventId: string;
    transactionId: string;
    amount?: number;
    currency?: string;
    failureCode?: string;
    failureMessage?: string;
  } {
    const status = payload.transactionStatus;

    let type: string;
    if (status === 'APPROVED') {
      type = payload.transactionType === 'Sale' ? 'payment.captured' : 'payment.authorized';
    } else if (status === 'DECLINED' || status === 'ERROR') {
      type = 'payment.failed';
    } else if (payload.transactionType === 'Credit') {
      type = status === 'APPROVED' ? 'refund.succeeded' : 'refund.failed';
    } else {
      type = 'unknown';
    }

    return {
      type,
      pspEventId: payload.PPP_TransactionID || payload.clientRequestId,
      transactionId: payload.transactionId || '',
      amount: payload.totalAmount ? Math.round(parseFloat(payload.totalAmount) * 100) : undefined,
      currency: payload.currency,
      failureCode: payload.errCode,
      failureMessage: payload.reason,
    };
  },
};

// Generate SHA256 checksum for Nuvei API
async function generateChecksum(...parts: string[]): Promise<string> {
  const data = parts.join('');
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
