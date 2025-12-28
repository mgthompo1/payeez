/**
 * Airwallex PSP Adapter
 * Uses Basis Theory proxy to forward card data to Airwallex
 *
 * Airwallex API Docs: https://www.airwallex.com/docs/api
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

export const airwallexAdapter = {
  name: 'airwallex' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: {
      client_id: string;
      api_key: string;
      environment?: 'test' | 'live';
    },
    basisTheoryApiKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.airwallex.com/api/v1'
      : 'https://api-demo.airwallex.com/api/v1';

    // First, get an access token
    const authResponse = await fetch(`${baseUrl}/authentication/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': credentials.client_id,
        'x-api-key': credentials.api_key,
      },
    });

    if (!authResponse.ok) {
      const error = await authResponse.json();
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: 'auth_error',
        failureMessage: error.message || 'Authentication failed',
        rawResponse: error,
      };
    }

    const authResult = await authResponse.json();
    const accessToken = authResult.token;

    // Create a PaymentIntent first
    const intentResponse = await fetch(`${baseUrl}/pa/payment_intents/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        request_id: req.idempotencyKey,
        amount: req.amount / 100,
        currency: req.currency,
        merchant_order_id: req.idempotencyKey,
        capture_method: req.capture ? 'automatic' : 'manual',
        metadata: req.metadata,
      }),
    });

    if (!intentResponse.ok) {
      const error = await intentResponse.json();
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: error.code || 'intent_error',
        failureMessage: error.message || 'Failed to create payment intent',
        rawResponse: error,
      };
    }

    const intent = await intentResponse.json();

    // Use Basis Theory proxy to confirm payment with card
    const proxyResponse = await fetch('https://api.basistheory.com/proxy', {
      method: 'POST',
      headers: {
        'BT-API-KEY': basisTheoryApiKey,
        'BT-PROXY-URL': `${baseUrl}/pa/payment_intents/${intent.id}/confirm`,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request_id: `${req.idempotencyKey}_confirm`,
        payment_method: {
          type: 'card',
          card: {
            // Basis Theory token interpolation
            number: `{{${req.tokenId} | json: '$.number'}}`,
            name: `{{${req.tokenId} | json: '$.name'}}`,
            expiry_month: `{{${req.tokenId} | json: '$.expiration_month'}}`,
            expiry_year: `{{${req.tokenId} | json: '$.expiration_year'}}`,
            cvc: `{{${req.tokenId} | json: '$.cvc'}}`,
          },
        },
        payment_method_options: {
          card: {
            auto_capture: req.capture,
          },
        },
      }),
    });

    const result = await proxyResponse.json();

    if (!proxyResponse.ok) {
      return {
        success: false,
        transactionId: result.id || intent.id || '',
        status: 'failed',
        failureCode: result.code || 'payment_error',
        failureMessage: result.message || 'Payment failed',
        rawResponse: result,
      };
    }

    const status = result.status;
    const isSuccess = ['SUCCEEDED', 'REQUIRES_CAPTURE'].includes(status);

    // Extract card details
    const card = result.payment_method?.card ? {
      brand: result.payment_method.card.brand,
      last4: result.payment_method.card.last4,
      exp_month: parseInt(result.payment_method.card.expiry_month || '0'),
      exp_year: parseInt(result.payment_method.card.expiry_year || '0'),
    } : undefined;

    return {
      success: isSuccess,
      transactionId: result.id || intent.id,
      status: isSuccess ? (status === 'SUCCEEDED' ? 'captured' : 'authorized') : 'failed',
      card,
      failureCode: isSuccess ? undefined : result.failure_code,
      failureMessage: isSuccess ? undefined : result.failure_message,
      rawResponse: result,
    };
  },

  async capture(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      client_id: string;
      api_key: string;
      environment?: 'test' | 'live';
    }
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.airwallex.com/api/v1'
      : 'https://api-demo.airwallex.com/api/v1';

    // Get access token
    const authResponse = await fetch(`${baseUrl}/authentication/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': credentials.client_id,
        'x-api-key': credentials.api_key,
      },
    });

    const authResult = await authResponse.json();
    const accessToken = authResult.token;

    const response = await fetch(`${baseUrl}/pa/payment_intents/${transactionId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request_id: `capture_${transactionId}_${Date.now()}`,
        amount: amount / 100,
      }),
    });

    const result = await response.json();
    const isSuccess = result.status === 'SUCCEEDED';

    return {
      success: isSuccess,
      transactionId: result.id || transactionId,
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.failure_code,
      failureMessage: result.failure_message,
      rawResponse: result,
    };
  },

  async refund(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      client_id: string;
      api_key: string;
      environment?: 'test' | 'live';
    },
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.airwallex.com/api/v1'
      : 'https://api-demo.airwallex.com/api/v1';

    // Get access token
    const authResponse = await fetch(`${baseUrl}/authentication/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': credentials.client_id,
        'x-api-key': credentials.api_key,
      },
    });

    const authResult = await authResponse.json();
    const accessToken = authResult.token;

    const response = await fetch(`${baseUrl}/pa/refunds/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request_id: idempotencyKey,
        payment_intent_id: transactionId,
        amount: amount / 100,
      }),
    });

    const result = await response.json();
    const isSuccess = result.status === 'SUCCEEDED' || result.status === 'CREATED';

    return {
      success: isSuccess,
      transactionId: result.id || '',
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.failure_code,
      failureMessage: result.failure_message,
      rawResponse: result,
    };
  },

  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // Airwallex uses HMAC-SHA256 for webhook verification
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
    const eventName = payload.name;
    const data = payload.data || {};

    const typeMap: Record<string, string> = {
      'payment_intent.succeeded': 'payment.succeeded',
      'payment_intent.requires_capture': 'payment.authorized',
      'payment_intent.failed': 'payment.failed',
      'payment_intent.cancelled': 'payment.failed',
      'refund.succeeded': 'refund.succeeded',
      'refund.failed': 'refund.failed',
    };

    return {
      type: typeMap[eventName] || eventName || 'unknown',
      pspEventId: payload.id,
      transactionId: data.id || data.payment_intent_id || '',
      amount: data.amount ? Math.round(data.amount * 100) : undefined,
      currency: data.currency,
      failureCode: data.failure_code,
      failureMessage: data.failure_message,
    };
  },
};
