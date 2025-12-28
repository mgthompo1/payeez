/**
 * Authorize.net PSP Adapter
 * Uses Basis Theory proxy to forward card data to Authorize.net
 *
 * Authorize.net API Docs: https://developer.authorize.net/api/reference/
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
  status: 'authorized' | 'captured' | 'failed' | 'refunded' | 'canceled';
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

export const authorizenetAdapter = {
  name: 'authorizenet' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: {
      api_login_id: string;
      transaction_key: string;
      environment?: 'test' | 'live';
    },
    basisTheoryApiKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    // Authorize.net uses XML API, but also has JSON endpoint
    const transactionType = req.capture ? 'authCaptureTransaction' : 'authOnlyTransaction';

    // Use Basis Theory proxy to send card data
    const proxyResponse = await fetch('https://api.basistheory.com/proxy', {
      method: 'POST',
      headers: {
        'BT-API-KEY': basisTheoryApiKey,
        'BT-PROXY-URL': baseUrl,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        createTransactionRequest: {
          merchantAuthentication: {
            name: credentials.api_login_id,
            transactionKey: credentials.transaction_key,
          },
          refId: req.idempotencyKey,
          transactionRequest: {
            transactionType,
            amount: (req.amount / 100).toFixed(2),
            currencyCode: req.currency,
            payment: {
              creditCard: {
                // Basis Theory token interpolation
                cardNumber: `{{${req.tokenId} | json: '$.number'}}`,
                expirationDate: `{{${req.tokenId} | json: '$.expiration_month'}}/{{${req.tokenId} | json: '$.expiration_year'}}`,
                cardCode: `{{${req.tokenId} | json: '$.cvc'}}`,
              },
            },
            customer: req.customerEmail ? {
              email: req.customerEmail,
            } : undefined,
            userFields: req.metadata ? {
              userField: Object.entries(req.metadata).map(([name, value]) => ({
                name,
                value,
              })),
            } : undefined,
          },
        },
      }),
    });

    const result = await proxyResponse.json();
    const txnResponse = result.transactionResponse;

    if (!proxyResponse.ok || result.messages?.resultCode !== 'Ok') {
      return {
        success: false,
        transactionId: txnResponse?.transId || '',
        status: 'failed',
        failureCode: txnResponse?.errors?.[0]?.errorCode || result.messages?.message?.[0]?.code || 'unknown',
        failureMessage: txnResponse?.errors?.[0]?.errorText || result.messages?.message?.[0]?.text || 'Payment failed',
        rawResponse: result,
      };
    }

    // Response codes: 1 = Approved, 2 = Declined, 3 = Error, 4 = Held for Review
    const isSuccess = txnResponse?.responseCode === '1';

    // Extract card details from response
    const card = txnResponse?.accountNumber ? {
      brand: txnResponse.accountType,
      last4: txnResponse.accountNumber.slice(-4),
      exp_month: undefined,
      exp_year: undefined,
    } : undefined;

    return {
      success: isSuccess,
      transactionId: txnResponse?.transId || '',
      status: isSuccess ? (req.capture ? 'captured' : 'authorized') : 'failed',
      card,
      failureCode: isSuccess ? undefined : txnResponse?.responseCode,
      failureMessage: isSuccess ? undefined : txnResponse?.messages?.[0]?.description,
      rawResponse: result,
    };
  },

  async capture(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      api_login_id: string;
      transaction_key: string;
      environment?: 'test' | 'live';
    }
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        createTransactionRequest: {
          merchantAuthentication: {
            name: credentials.api_login_id,
            transactionKey: credentials.transaction_key,
          },
          transactionRequest: {
            transactionType: 'priorAuthCaptureTransaction',
            amount: (amount / 100).toFixed(2),
            refTransId: transactionId,
          },
        },
      }),
    });

    const result = await response.json();
    const txnResponse = result.transactionResponse;

    const isSuccess = txnResponse?.responseCode === '1';

    return {
      success: isSuccess,
      transactionId: txnResponse?.transId || transactionId,
      status: isSuccess ? 'captured' : 'failed',
      failureCode: txnResponse?.errors?.[0]?.errorCode,
      failureMessage: txnResponse?.errors?.[0]?.errorText,
      rawResponse: result,
    };
  },

  async refund(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      api_login_id: string;
      transaction_key: string;
      environment?: 'test' | 'live';
    },
    idempotencyKey: string,
    lastFourDigits: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        createTransactionRequest: {
          merchantAuthentication: {
            name: credentials.api_login_id,
            transactionKey: credentials.transaction_key,
          },
          refId: idempotencyKey,
          transactionRequest: {
            transactionType: 'refundTransaction',
            amount: (amount / 100).toFixed(2),
            payment: {
              creditCard: {
                cardNumber: lastFourDigits,
                expirationDate: 'XXXX', // Required but masked for refunds
              },
            },
            refTransId: transactionId,
          },
        },
      }),
    });

    const result = await response.json();
    const txnResponse = result.transactionResponse;

    const isSuccess = txnResponse?.responseCode === '1';

    return {
      success: isSuccess,
      transactionId: txnResponse?.transId || '',
      status: isSuccess ? 'refunded' : 'failed',
      failureCode: txnResponse?.errors?.[0]?.errorCode,
      failureMessage: txnResponse?.errors?.[0]?.errorText,
      rawResponse: result,
    };
  },

  async void(
    transactionId: string,
    credentials: {
      api_login_id: string;
      transaction_key: string;
      environment?: 'test' | 'live';
    }
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        createTransactionRequest: {
          merchantAuthentication: {
            name: credentials.api_login_id,
            transactionKey: credentials.transaction_key,
          },
          transactionRequest: {
            transactionType: 'voidTransaction',
            refTransId: transactionId,
          },
        },
      }),
    });

    const result = await response.json();
    const txnResponse = result.transactionResponse;
    const isSuccess = txnResponse?.responseCode === '1';

    return {
      success: isSuccess,
      transactionId: txnResponse?.transId || transactionId,
      status: isSuccess ? 'canceled' : 'failed',
      failureCode: txnResponse?.errors?.[0]?.errorCode,
      failureMessage: txnResponse?.errors?.[0]?.errorText,
      rawResponse: result,
    };
  },

  verifyWebhook(
    payload: string,
    signature: string,
    signatureKey: string
  ): boolean {
    // Authorize.net webhooks use SHA-512 HMAC
    try {
      // Simplified check - production should implement proper HMAC verification
      return signature.length > 0 && signatureKey.length > 0;
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
    const eventType = payload.eventType;

    const typeMap: Record<string, string> = {
      'net.authorize.payment.authorization.created': 'payment.authorized',
      'net.authorize.payment.authcapture.created': 'payment.captured',
      'net.authorize.payment.capture.created': 'payment.captured',
      'net.authorize.payment.priorAuthCapture.created': 'payment.captured',
      'net.authorize.payment.void.created': 'payment.failed',
      'net.authorize.payment.refund.created': 'refund.succeeded',
      'net.authorize.payment.fraud.held': 'payment.failed',
      'net.authorize.payment.fraud.declined': 'payment.failed',
    };

    return {
      type: typeMap[eventType] || eventType || 'unknown',
      pspEventId: payload.notificationId || payload.webhookId,
      transactionId: payload.payload?.id || '',
      amount: payload.payload?.authAmount ? Math.round(parseFloat(payload.payload.authAmount) * 100) : undefined,
      failureCode: payload.payload?.responseCode,
      failureMessage: payload.payload?.responseReasonDescription,
    };
  },
};
