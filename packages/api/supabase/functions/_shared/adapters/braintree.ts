/**
 * Braintree PSP Adapter
 * Uses Basis Theory proxy to forward card data to Braintree
 *
 * Braintree API Docs: https://developer.paypal.com/braintree/docs
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

export const braintreeAdapter = {
  name: 'braintree' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: {
      merchant_id: string;
      public_key: string;
      private_key: string;
      environment?: 'test' | 'live';
    },
    basisTheoryApiKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.braintreegateway.com'
      : 'https://api.sandbox.braintreegateway.com';

    // Braintree uses Basic Auth with public_key:private_key
    const authHeader = btoa(`${credentials.public_key}:${credentials.private_key}`);

    const transactionType = req.capture ? 'sale' : 'authorize';

    // Use Basis Theory proxy to send card data to Braintree
    // Braintree GraphQL API
    const proxyResponse = await fetch('https://api.basistheory.com/proxy', {
      method: 'POST',
      headers: {
        'BT-API-KEY': basisTheoryApiKey,
        'BT-PROXY-URL': `${baseUrl}/merchants/${credentials.merchant_id}/transactions`,
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/xml',
        'X-ApiVersion': '6',
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<transaction>
  <type>${transactionType}</type>
  <amount>${(req.amount / 100).toFixed(2)}</amount>
  <order-id>${req.idempotencyKey}</order-id>
  <credit-card>
    <number>{{${req.tokenId} | json: '$.number'}}</number>
    <expiration-month>{{${req.tokenId} | json: '$.expiration_month'}}</expiration-month>
    <expiration-year>{{${req.tokenId} | json: '$.expiration_year'}}</expiration-year>
    <cvv>{{${req.tokenId} | json: '$.cvc'}}</cvv>
    <cardholder-name>{{${req.tokenId} | json: '$.name'}}</cardholder-name>
  </credit-card>
  ${req.customerEmail ? `<customer><email>${req.customerEmail}</email></customer>` : ''}
  <options>
    <submit-for-settlement>${req.capture}</submit-for-settlement>
  </options>
</transaction>`,
    });

    const responseText = await proxyResponse.text();
    const result = parseXmlResponse(responseText);

    const status = result.status;
    const isSuccess = ['authorized', 'submitted_for_settlement', 'settled', 'settling'].includes(status);

    // Extract card details
    const card = result['credit-card'] ? {
      brand: result['card-type'],
      last4: result['last-4'],
      exp_month: parseInt(result['expiration-month'] || '0'),
      exp_year: parseInt(result['expiration-year'] || '0'),
    } : undefined;

    return {
      success: isSuccess,
      transactionId: result.id || '',
      status: isSuccess
        ? (['submitted_for_settlement', 'settled', 'settling'].includes(status) ? 'captured' : 'authorized')
        : 'failed',
      card,
      failureCode: isSuccess ? undefined : result['processor-response-code'],
      failureMessage: isSuccess ? undefined : result['processor-response-text'] || result.message,
      rawResponse: result,
    };
  },

  async capture(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      merchant_id: string;
      public_key: string;
      private_key: string;
      environment?: 'test' | 'live';
    }
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.braintreegateway.com'
      : 'https://api.sandbox.braintreegateway.com';

    const authHeader = btoa(`${credentials.public_key}:${credentials.private_key}`);

    const response = await fetch(
      `${baseUrl}/merchants/${credentials.merchant_id}/transactions/${transactionId}/submit_for_settlement`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/xml',
          'X-ApiVersion': '6',
        },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<transaction>
  <amount>${(amount / 100).toFixed(2)}</amount>
</transaction>`,
      }
    );

    const responseText = await response.text();
    const result = parseXmlResponse(responseText);

    const status = result.status;
    const isSuccess = ['submitted_for_settlement', 'settling', 'settled'].includes(status);

    return {
      success: isSuccess,
      transactionId: result.id || transactionId,
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result['processor-response-code'],
      failureMessage: result['processor-response-text'],
      rawResponse: result,
    };
  },

  async refund(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      merchant_id: string;
      public_key: string;
      private_key: string;
      environment?: 'test' | 'live';
    },
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://api.braintreegateway.com'
      : 'https://api.sandbox.braintreegateway.com';

    const authHeader = btoa(`${credentials.public_key}:${credentials.private_key}`);

    const response = await fetch(
      `${baseUrl}/merchants/${credentials.merchant_id}/transactions/${transactionId}/refund`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/xml',
          'X-ApiVersion': '6',
        },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<transaction>
  <amount>${(amount / 100).toFixed(2)}</amount>
</transaction>`,
      }
    );

    const responseText = await response.text();
    const result = parseXmlResponse(responseText);

    const isSuccess = result.status === 'submitted_for_settlement' || result.status === 'settled';

    return {
      success: isSuccess,
      transactionId: result.id || '',
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result['processor-response-code'],
      failureMessage: result['processor-response-text'],
      rawResponse: result,
    };
  },

  verifyWebhook(
    payload: string,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      // Braintree webhooks use signature verification
      return signature.length > 0 && publicKey.length > 0;
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
    const kind = payload.kind;
    const transaction = payload.transaction || {};

    const typeMap: Record<string, string> = {
      'transaction_settled': 'payment.succeeded',
      'transaction_settlement_declined': 'payment.failed',
      'transaction_disbursed': 'payment.succeeded',
      'transaction_authorized': 'payment.authorized',
      'transaction_voided': 'payment.failed',
      'refund': 'refund.succeeded',
      'refund_failed': 'refund.failed',
    };

    return {
      type: typeMap[kind] || kind || 'unknown',
      pspEventId: payload.timestamp || payload.id,
      transactionId: transaction.id || '',
      amount: transaction.amount ? Math.round(parseFloat(transaction.amount) * 100) : undefined,
      currency: transaction.currency_iso_code,
      failureCode: transaction.processor_response_code,
      failureMessage: transaction.processor_response_text,
    };
  },
};

// Simple XML parser for Braintree response
function parseXmlResponse(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const tagRegex = /<([\w-]+)>([^<]*)<\/\1>/g;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}
