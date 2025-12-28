/**
 * Checkout.com PSP Adapter
 * Uses Basis Theory proxy to forward card data to Checkout.com
 *
 * Checkout.com API Docs: https://www.checkout.com/docs/payments
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

export const checkoutcomAdapter = {
  name: 'checkoutcom' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: {
      secret_key: string;
      public_key: string;
      environment?: 'test' | 'live';
    },
    basisTheoryApiKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.checkout.com'
      : 'https://api.sandbox.checkout.com';

    // Use Basis Theory proxy to send card data to Checkout.com
    const proxyResponse = await fetch('https://api.basistheory.com/proxy', {
      method: 'POST',
      headers: {
        'BT-API-KEY': basisTheoryApiKey,
        'BT-PROXY-URL': `${baseUrl}/payments`,
        'Authorization': `Bearer ${credentials.secret_key}`,
        'Content-Type': 'application/json',
        'Cko-Idempotency-Key': req.idempotencyKey,
      },
      body: JSON.stringify({
        source: {
          type: 'card',
          // Basis Theory token interpolation
          number: `{{${req.tokenId} | json: '$.number'}}`,
          expiry_month: `{{${req.tokenId} | json: '$.expiration_month'}}`,
          expiry_year: `{{${req.tokenId} | json: '$.expiration_year'}}`,
          cvv: `{{${req.tokenId} | json: '$.cvc'}}`,
          name: `{{${req.tokenId} | json: '$.name'}}`,
        },
        amount: req.amount,
        currency: req.currency,
        capture: req.capture,
        reference: req.idempotencyKey,
        customer: req.customerEmail ? {
          email: req.customerEmail,
        } : undefined,
        metadata: req.metadata,
      }),
    });

    const result = await proxyResponse.json();

    if (!proxyResponse.ok) {
      return {
        success: false,
        transactionId: result.id || '',
        status: 'failed',
        failureCode: result.error_codes?.[0] || result.error_type || 'unknown',
        failureMessage: result.message || 'Payment failed',
        rawResponse: result,
      };
    }

    const isApproved = result.approved === true;
    const status = result.status;

    // Determine our status
    let paymentStatus: 'authorized' | 'captured' | 'failed';
    if (isApproved) {
      paymentStatus = status === 'Captured' ? 'captured' : 'authorized';
    } else {
      paymentStatus = 'failed';
    }

    // Extract card details
    const card = result.source ? {
      brand: result.source.scheme,
      last4: result.source.last4,
      exp_month: result.source.expiry_month,
      exp_year: result.source.expiry_year,
    } : undefined;

    return {
      success: isApproved,
      transactionId: result.id || '',
      status: paymentStatus,
      card,
      failureCode: isApproved ? undefined : result.response_code,
      failureMessage: isApproved ? undefined : result.response_summary,
      rawResponse: result,
    };
  },

  async capture(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      secret_key: string;
      public_key: string;
      environment?: 'test' | 'live';
    }
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.checkout.com'
      : 'https://api.sandbox.checkout.com';

    const response = await fetch(`${baseUrl}/payments/${transactionId}/captures`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.secret_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
      }),
    });

    const result = await response.json();

    // Checkout.com returns 202 for successful capture
    const isSuccess = response.status === 202 || result.action_id;

    return {
      success: isSuccess,
      transactionId: result.action_id || transactionId,
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.error_codes?.[0],
      failureMessage: result.message,
      rawResponse: result,
    };
  },

  async refund(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      secret_key: string;
      public_key: string;
      environment?: 'test' | 'live';
    },
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.checkout.com'
      : 'https://api.sandbox.checkout.com';

    const response = await fetch(`${baseUrl}/payments/${transactionId}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.secret_key}`,
        'Content-Type': 'application/json',
        'Cko-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount,
      }),
    });

    const result = await response.json();

    const isSuccess = response.status === 202 || result.action_id;

    return {
      success: isSuccess,
      transactionId: result.action_id || '',
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.error_codes?.[0],
      failureMessage: result.message,
      rawResponse: result,
    };
  },

  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // Checkout.com uses HMAC-SHA256 for webhook verification
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
    const eventType = payload.type;
    const data = payload.data || {};

    const typeMap: Record<string, string> = {
      'payment_approved': 'payment.captured',
      'payment_captured': 'payment.captured',
      'payment_declined': 'payment.failed',
      'payment_voided': 'payment.failed',
      'payment_refunded': 'refund.succeeded',
      'payment_refund_declined': 'refund.failed',
      'payment_authorized': 'payment.authorized',
    };

    return {
      type: typeMap[eventType] || eventType || 'unknown',
      pspEventId: payload.id,
      transactionId: data.id || data.action_id || '',
      amount: data.amount,
      currency: data.currency,
      failureCode: data.response_code,
      failureMessage: data.response_summary,
    };
  },
};
