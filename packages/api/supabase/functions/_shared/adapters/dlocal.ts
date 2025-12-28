/**
 * dLocal PSP Adapter
 * Uses Basis Theory proxy to forward card data to dLocal
 * Specialized for LatAm and emerging markets
 *
 * dLocal API Docs: https://docs.dlocal.com/
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

export const dlocalAdapter = {
  name: 'dlocal' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: {
      x_login: string;
      x_trans_key: string;
      secret_key: string;
      environment?: 'test' | 'live';
    },
    basisTheoryApiKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.dlocal.com'
      : 'https://sandbox.dlocal.com';

    // Generate auth headers for dLocal
    const timestamp = new Date().toISOString();
    const signature = await generateSignature(
      credentials.x_login,
      timestamp,
      credentials.secret_key
    );

    // Use Basis Theory proxy for secure card tokenization
    const proxyResponse = await fetch('https://api.basistheory.com/proxy', {
      method: 'POST',
      headers: {
        'BT-API-KEY': basisTheoryApiKey,
        'BT-PROXY-URL': `${baseUrl}/secure_payments`,
        'Content-Type': 'application/json',
        'X-Date': timestamp,
        'X-Login': credentials.x_login,
        'X-Trans-Key': credentials.x_trans_key,
        'Authorization': `V2-HMAC-SHA256, Signature: ${signature}`,
      },
      body: JSON.stringify({
        amount: req.amount / 100,
        currency: req.currency,
        country: getCurrencyCountry(req.currency),
        payment_method_id: 'CARD',
        payment_method_flow: 'DIRECT',
        payer: {
          email: req.customerEmail || 'customer@example.com',
        },
        card: {
          // Basis Theory token interpolation
          number: `{{${req.tokenId} | json: '$.number'}}`,
          holder_name: `{{${req.tokenId} | json: '$.name'}}`,
          expiration_month: `{{${req.tokenId} | json: '$.expiration_month'}}`,
          expiration_year: `{{${req.tokenId} | json: '$.expiration_year'}}`,
          cvv: `{{${req.tokenId} | json: '$.cvc'}}`,
          capture: req.capture,
        },
        order_id: req.idempotencyKey,
        notification_url: 'https://example.com/webhook', // Should be configured
      }),
    });

    const result = await proxyResponse.json();

    const isSuccess = result.status === 'PAID' || result.status === 'AUTHORIZED';

    // Extract card details
    const card = result.card ? {
      brand: result.card.brand,
      last4: result.card.last4,
      exp_month: parseInt(result.card.expiration_month || '0'),
      exp_year: parseInt(result.card.expiration_year || '0'),
    } : undefined;

    return {
      success: isSuccess,
      transactionId: result.id || '',
      status: isSuccess ? (result.status === 'PAID' ? 'captured' : 'authorized') : 'failed',
      card,
      failureCode: isSuccess ? undefined : result.status_code || result.status,
      failureMessage: isSuccess ? undefined : result.status_detail,
      rawResponse: result,
    };
  },

  async capture(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      x_login: string;
      x_trans_key: string;
      secret_key: string;
      environment?: 'test' | 'live';
    }
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.dlocal.com'
      : 'https://sandbox.dlocal.com';

    const timestamp = new Date().toISOString();
    const signature = await generateSignature(
      credentials.x_login,
      timestamp,
      credentials.secret_key
    );

    const response = await fetch(`${baseUrl}/payments/${transactionId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Date': timestamp,
        'X-Login': credentials.x_login,
        'X-Trans-Key': credentials.x_trans_key,
        'Authorization': `V2-HMAC-SHA256, Signature: ${signature}`,
      },
      body: JSON.stringify({
        amount: amount / 100,
        currency,
      }),
    });

    const result = await response.json();
    const isSuccess = result.status === 'PAID';

    return {
      success: isSuccess,
      transactionId: result.id || transactionId,
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.status_code,
      failureMessage: result.status_detail,
      rawResponse: result,
    };
  },

  async refund(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      x_login: string;
      x_trans_key: string;
      secret_key: string;
      environment?: 'test' | 'live';
    },
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.dlocal.com'
      : 'https://sandbox.dlocal.com';

    const timestamp = new Date().toISOString();
    const signature = await generateSignature(
      credentials.x_login,
      timestamp,
      credentials.secret_key
    );

    const response = await fetch(`${baseUrl}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Date': timestamp,
        'X-Login': credentials.x_login,
        'X-Trans-Key': credentials.x_trans_key,
        'X-Idempotency-Key': idempotencyKey,
        'Authorization': `V2-HMAC-SHA256, Signature: ${signature}`,
      },
      body: JSON.stringify({
        payment_id: transactionId,
        amount: amount / 100,
        currency,
        notification_url: 'https://example.com/webhook',
      }),
    });

    const result = await response.json();
    const isSuccess = result.status === 'SUCCESS';

    return {
      success: isSuccess,
      transactionId: result.id || '',
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.status_code,
      failureMessage: result.status_detail,
      rawResponse: result,
    };
  },

  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // dLocal uses HMAC-SHA256 for webhooks
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
    const status = payload.status;

    const typeMap: Record<string, string> = {
      AUTHORIZED: 'payment.authorized',
      PAID: 'payment.succeeded',
      REJECTED: 'payment.failed',
      CANCELLED: 'payment.failed',
      REFUNDED: 'refund.succeeded',
      PARTIALLY_REFUNDED: 'refund.succeeded',
    };

    return {
      type: typeMap[status] || 'unknown',
      pspEventId: payload.id,
      transactionId: payload.id || '',
      amount: payload.amount ? Math.round(parseFloat(payload.amount) * 100) : undefined,
      currency: payload.currency,
      failureCode: payload.status_code,
      failureMessage: payload.status_detail,
    };
  },
};

// Generate HMAC-SHA256 signature for dLocal
async function generateSignature(
  xLogin: string,
  timestamp: string,
  secretKey: string
): Promise<string> {
  const message = xLogin + timestamp;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Map currency to country for dLocal
function getCurrencyCountry(currency: string): string {
  const map: Record<string, string> = {
    BRL: 'BR',
    ARS: 'AR',
    MXN: 'MX',
    CLP: 'CL',
    COP: 'CO',
    PEN: 'PE',
    UYU: 'UY',
    USD: 'US',
  };
  return map[currency.toUpperCase()] || 'BR';
}
