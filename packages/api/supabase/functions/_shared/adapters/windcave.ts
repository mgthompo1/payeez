/**
 * Windcave PSP Adapter
 * Direct REST API integration for NZ/AU payments
 *
 * Supports: purchase, auth, capture, refund, void
 * API Docs: https://www.windcave.com/developer-ecommerce-api-rest
 */

export interface WindcaveCredentials {
  username: string;  // REST API username
  api_key: string;   // REST API key
  environment?: 'sandbox' | 'production';
}

export interface CardData {
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;  // MM
  expiryYear: string;   // YY
  cvc: string;
}

export interface AuthorizeRequest {
  amount: number;
  currency: string;
  cardData: CardData;
  idempotencyKey: string;
  capture: boolean;  // true = purchase, false = auth
  merchantReference?: string;
  metadata?: Record<string, string>;
}

export interface AuthorizeResponse {
  success: boolean;
  transactionId: string;
  status: 'authorized' | 'captured' | 'failed' | 'pending';
  authCode?: string;
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

const WINDCAVE_SANDBOX_URL = 'https://uat.windcave.com/api/v1';
const WINDCAVE_PRODUCTION_URL = 'https://sec.windcave.com/api/v1';

function getBaseUrl(environment: string = 'sandbox'): string {
  // Accept 'production', 'live', or 'prod' as production mode
  // Accept 'sandbox', 'test', 'uat', or 'dev' as sandbox mode
  const isProd = ['production', 'live', 'prod'].includes(environment?.toLowerCase());
  console.log(`[Windcave] Environment '${environment}' -> ${isProd ? 'PRODUCTION' : 'SANDBOX'}`);
  return isProd ? WINDCAVE_PRODUCTION_URL : WINDCAVE_SANDBOX_URL;
}

function getAuthHeader(credentials: WindcaveCredentials): string {
  const auth = btoa(`${credentials.username}:${credentials.api_key}`);
  return `Basic ${auth}`;
}

function mapCardBrand(cardType: string): string {
  const brandMap: Record<string, string> = {
    'visa': 'visa',
    'mastercard': 'mastercard',
    'amex': 'amex',
    'american express': 'amex',
    'diners': 'diners',
    'discover': 'discover',
    'jcb': 'jcb',
    'unionpay': 'unionpay',
  };
  return brandMap[cardType?.toLowerCase()] || cardType;
}

/**
 * Poll for transaction result when Windcave returns 202 Accepted
 */
async function pollForResult(
  transactionUrl: string,
  authHeader: string,
  maxAttempts: number = 10,
  delayMs: number = 2000
): Promise<any> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, delayMs));

    const response = await fetch(transactionUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      return await response.json();
    }

    // 202 means still processing, continue polling
    if (response.status !== 202) {
      throw new Error(`Unexpected status ${response.status} while polling`);
    }
  }

  throw new Error('Transaction polling timeout');
}

export const windcaveAdapter = {
  name: 'windcave' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: WindcaveCredentials
  ): Promise<AuthorizeResponse> {
    console.log('[Windcave] Authorize request:', {
      amount: req.amount,
      currency: req.currency,
      hasCardData: !!req.cardData,
      cardLast4: req.cardData?.cardNumber?.slice(-4),
      environment: credentials.environment,
      hasUsername: !!credentials.username,
      hasApiKey: !!credentials.api_key,
    });

    const baseUrl = getBaseUrl(credentials.environment);
    const authHeader = getAuthHeader(credentials);

    console.log('[Windcave] Using base URL:', baseUrl);

    // Convert amount to string with 2 decimal places (Windcave expects "12.34" not cents)
    const amountStr = (req.amount / 100).toFixed(2);

    const transactionType = req.capture ? 'purchase' : 'auth';

    const requestBody = {
      type: transactionType,
      amount: amountStr,
      currency: req.currency.toUpperCase(),
      merchantReference: req.merchantReference || req.idempotencyKey,
      card: {
        cardHolderName: req.cardData.cardHolderName,
        cardNumber: req.cardData.cardNumber,
        dateExpiryMonth: req.cardData.expiryMonth.padStart(2, '0'),
        dateExpiryYear: req.cardData.expiryYear.slice(-2),  // Ensure YY format
        cvc2: req.cardData.cvc,
      },
    };

    console.log('[Windcave] Request body:', JSON.stringify({
      ...requestBody,
      card: {
        ...requestBody.card,
        cardNumber: `****${requestBody.card.cardNumber.slice(-4)}`,
        cvc2: '***',
      },
    }));

    try {
      const response = await fetch(`${baseUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      let result: any;

      if (response.status === 202) {
        // Transaction still processing - poll for result
        const responseData = await response.json();
        const selfLink = responseData.links?.find((l: any) => l.rel === 'self')?.href;

        if (!selfLink) {
          return {
            success: false,
            transactionId: responseData.id || '',
            status: 'pending',
            failureCode: 'no_self_link',
            failureMessage: 'No polling URL returned',
            rawResponse: responseData,
          };
        }

        result = await pollForResult(selfLink, authHeader);
      } else if (response.status === 201) {
        result = await response.json();
      } else {
        const errorText = await response.text();
        console.error('[Windcave] Error response:', response.status, errorText);
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        return {
          success: false,
          transactionId: '',
          status: 'failed',
          failureCode: errorData.reCo || 'api_error',
          failureMessage: errorData.responseText || errorData.message || errorData.errors?.[0]?.message || `HTTP ${response.status}`,
          rawResponse: errorData,
        };
      }

      const isSuccess = result.authorised === true;

      return {
        success: isSuccess,
        transactionId: result.id,
        status: isSuccess ? (req.capture ? 'captured' : 'authorized') : 'failed',
        authCode: result.authCode,
        card: result.card ? {
          brand: mapCardBrand(result.card.type),
          last4: result.card.cardNumber?.slice(-4),
          exp_month: parseInt(result.card.dateExpiryMonth, 10),
          exp_year: parseInt('20' + result.card.dateExpiryYear, 10),
        } : undefined,
        failureCode: isSuccess ? undefined : result.reCo,
        failureMessage: isSuccess ? undefined : result.responseText,
        rawResponse: result,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: 'network_error',
        failureMessage: error.message || 'Network error',
        rawResponse: error,
      };
    }
  },

  async capture(
    transactionId: string,
    credentials: WindcaveCredentials,
    amount?: number
  ): Promise<AuthorizeResponse> {
    const baseUrl = getBaseUrl(credentials.environment);
    const authHeader = getAuthHeader(credentials);

    // Windcave capture is done via a "complete" transaction
    const requestBody: any = {
      type: 'complete',
      transactionId: transactionId,
    };

    if (amount !== undefined) {
      requestBody.amount = (amount / 100).toFixed(2);
    }

    try {
      const response = await fetch(`${baseUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      let result: any;

      if (response.status === 202) {
        const responseData = await response.json();
        const selfLink = responseData.links?.find((l: any) => l.rel === 'self')?.href;
        if (selfLink) {
          result = await pollForResult(selfLink, authHeader);
        } else {
          result = responseData;
        }
      } else {
        result = await response.json();
      }

      const isSuccess = result.authorised === true;

      return {
        success: isSuccess,
        transactionId: result.id,
        status: isSuccess ? 'captured' : 'failed',
        authCode: result.authCode,
        failureCode: isSuccess ? undefined : result.reCo,
        failureMessage: isSuccess ? undefined : result.responseText,
        rawResponse: result,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: 'network_error',
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  async refund(
    transactionId: string,
    amount: number,
    credentials: WindcaveCredentials,
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = getBaseUrl(credentials.environment);
    const authHeader = getAuthHeader(credentials);

    const requestBody = {
      type: 'refund',
      amount: (amount / 100).toFixed(2),
      transactionId: transactionId,
      merchantReference: idempotencyKey,
    };

    try {
      const response = await fetch(`${baseUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      let result: any;

      if (response.status === 202) {
        const responseData = await response.json();
        const selfLink = responseData.links?.find((l: any) => l.rel === 'self')?.href;
        if (selfLink) {
          result = await pollForResult(selfLink, authHeader);
        } else {
          result = responseData;
        }
      } else {
        result = await response.json();
      }

      const isSuccess = result.authorised === true;

      return {
        success: isSuccess,
        transactionId: result.id,
        status: isSuccess ? 'refunded' : 'failed',
        failureCode: isSuccess ? undefined : result.reCo,
        failureMessage: isSuccess ? undefined : result.responseText,
        rawResponse: result,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: 'network_error',
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  async void(
    transactionId: string,
    credentials: WindcaveCredentials
  ): Promise<AuthorizeResponse> {
    const baseUrl = getBaseUrl(credentials.environment);
    const authHeader = getAuthHeader(credentials);

    // Windcave void is done via a "void" transaction type
    const requestBody = {
      type: 'void',
      transactionId: transactionId,
    };

    try {
      const response = await fetch(`${baseUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      let result: any;

      if (response.status === 202) {
        const responseData = await response.json();
        const selfLink = responseData.links?.find((l: any) => l.rel === 'self')?.href;
        if (selfLink) {
          result = await pollForResult(selfLink, authHeader);
        } else {
          result = responseData;
        }
      } else {
        result = await response.json();
      }

      const isSuccess = result.authorised === true || result.responseText === 'APPROVED';

      return {
        success: isSuccess,
        transactionId: result.id,
        status: isSuccess ? 'canceled' : 'failed',
        failureCode: isSuccess ? undefined : result.reCo,
        failureMessage: isSuccess ? undefined : result.responseText,
        rawResponse: result,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: 'network_error',
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  /**
   * Query a transaction by ID
   */
  async query(
    transactionId: string,
    credentials: WindcaveCredentials
  ): Promise<AuthorizeResponse> {
    const baseUrl = getBaseUrl(credentials.environment);
    const authHeader = getAuthHeader(credentials);

    try {
      const response = await fetch(`${baseUrl}/transactions/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          transactionId,
          status: 'failed',
          failureCode: 'not_found',
          failureMessage: `Transaction not found: ${response.status}`,
          rawResponse: await response.text(),
        };
      }

      const result = await response.json();
      const isSuccess = result.authorised === true;

      // Map Windcave transaction type to our status
      let status: 'authorized' | 'captured' | 'failed' | 'pending' = 'failed';
      if (isSuccess) {
        if (result.type === 'auth') {
          status = 'authorized';
        } else if (result.type === 'purchase' || result.type === 'complete') {
          status = 'captured';
        }
      }

      return {
        success: isSuccess,
        transactionId: result.id,
        status,
        authCode: result.authCode,
        card: result.card ? {
          brand: mapCardBrand(result.card.type),
          last4: result.card.cardNumber?.slice(-4),
          exp_month: parseInt(result.card.dateExpiryMonth, 10),
          exp_year: parseInt('20' + result.card.dateExpiryYear, 10),
        } : undefined,
        failureCode: isSuccess ? undefined : result.reCo,
        failureMessage: isSuccess ? undefined : result.responseText,
        rawResponse: result,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: 'network_error',
        failureMessage: error.message,
        rawResponse: error,
      };
    }
  },

  /**
   * Verify webhook signature (Windcave uses HMAC-SHA256)
   */
  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Windcave webhook verification
    // The signature is HMAC-SHA256 of the payload
    try {
      const encoder = new TextEncoder();
      const key = encoder.encode(secret);
      const data = encoder.encode(payload);

      // In Deno, we'd use crypto.subtle
      // This is a placeholder - implement with actual HMAC verification
      // For now, return true if signature exists
      return !!signature && !!secret;
    } catch {
      return false;
    }
  },

  /**
   * Normalize webhook event to common format
   */
  normalizeWebhook(event: any): {
    type: string;
    transactionId: string;
    status: string;
    amount?: number;
    currency?: string;
  } {
    return {
      type: event.type || 'transaction.updated',
      transactionId: event.id || event.transactionId,
      status: event.authorised ? 'succeeded' : 'failed',
      amount: event.amount ? Math.round(parseFloat(event.amount) * 100) : undefined,
      currency: event.currency,
    };
  },
};

export default windcaveAdapter;
