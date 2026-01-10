/**
 * Windcave PSP Adapter (Vault-Integrated)
 *
 * This is the refactored version that uses the vault abstraction.
 * Card data is NEVER touched by this code - it uses token placeholders
 * that get replaced by the vault proxy (BT, VGS, or Atlas CDE).
 *
 * Compare with: packages/api/supabase/functions/_shared/adapters/windcave.ts
 */

import { forwardToPSP, CARD } from '../psp-helper';

// =============================================================================
// Types
// =============================================================================

export interface WindcaveCredentials {
  username: string;
  api_key: string;
  environment?: 'sandbox' | 'production';
}

export interface AuthorizeRequest {
  tokenId: string;          // Vault token (replaces cardData)
  amount: number;           // In cents
  currency: string;
  capture: boolean;
  idempotencyKey: string;
  merchantReference?: string;
  metadata?: Record<string, string>;
  // Optional enhanced fields
  customerEmail?: string;
  billingAddress?: {
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
    street?: string;
  };
}

export interface AuthorizeResponse {
  success: boolean;
  transactionId: string;
  status: 'authorized' | 'captured' | 'failed' | 'pending';
  authCode?: string;
  card?: {
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
  };
  failureCode?: string;
  failureMessage?: string;
  rawResponse: unknown;
}

// =============================================================================
// Configuration
// =============================================================================

const WINDCAVE_SANDBOX_URL = 'https://uat.windcave.com/api/v1';
const WINDCAVE_PRODUCTION_URL = 'https://sec.windcave.com/api/v1';

function getBaseUrl(environment: string = 'sandbox'): string {
  const isProd = ['production', 'live', 'prod'].includes(environment?.toLowerCase());
  return isProd ? WINDCAVE_PRODUCTION_URL : WINDCAVE_SANDBOX_URL;
}

function getAuthHeader(credentials: WindcaveCredentials): string {
  // btoa works in both Node.js and Deno
  const auth = typeof btoa !== 'undefined'
    ? btoa(`${credentials.username}:${credentials.api_key}`)
    : Buffer.from(`${credentials.username}:${credentials.api_key}`).toString('base64');
  return `Basic ${auth}`;
}

// =============================================================================
// Adapter
// =============================================================================

export const windcaveAdapter = {
  name: 'windcave' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: WindcaveCredentials
  ): Promise<AuthorizeResponse> {
    const baseUrl = getBaseUrl(credentials.environment);
    const transactionType = req.capture ? 'purchase' : 'auth';
    const amountStr = (req.amount / 100).toFixed(2);

    // Build request with token placeholders
    // These get replaced by the vault proxy with real card data
    const requestBody: Record<string, unknown> = {
      type: transactionType,
      amount: amountStr,
      currency: req.currency.toUpperCase(),
      merchantReference: req.merchantReference || req.idempotencyKey,
      card: {
        cardHolderName: CARD.HOLDER_NAME,
        cardNumber: CARD.NUMBER,
        dateExpiryMonth: CARD.EXP_MONTH,
        dateExpiryYear: CARD.EXP_YEAR_2,  // Windcave wants 2-digit year
        cvc2: CARD.CVC,
      },
    };

    // Add AVS if billing address provided
    if (req.billingAddress) {
      requestBody.avs = {
        avsAction: 1,
        avsPostCode: req.billingAddress.postalCode,
        avsCity: req.billingAddress.city,
        avsState: req.billingAddress.state,
        avsCountry: req.billingAddress.country,
        avsStreetAddress: req.billingAddress.street,
      };
    }

    // Add customer email
    if (req.customerEmail) {
      requestBody.customerEmail = req.customerEmail;
    }

    // Add metadata
    if (req.metadata && Object.keys(req.metadata).length > 0) {
      requestBody.txnData1 = JSON.stringify(req.metadata).slice(0, 255);
    }

    console.log('[Windcave] Sending authorize request via vault proxy');

    try {
      // Forward through vault proxy
      // The proxy replaces CARD.NUMBER etc with real values from the token
      const response = await forwardToPSP<WindcaveAPIResponse>({
        psp: 'windcave',
        tokenId: req.tokenId,
        destination: `${baseUrl}/transactions`,
        method: 'POST',
        payload: requestBody,
        headers: {
          'Authorization': getAuthHeader(credentials),
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      console.log(`[Windcave] Response received in ${response.latencyMs}ms`);

      const result = response.data;

      // Handle 202 Accepted (async processing)
      if (response.status === 202) {
        // Would need to poll - for now return pending
        return {
          success: false,
          transactionId: result.id || '',
          status: 'pending',
          failureMessage: 'Transaction still processing',
          rawResponse: result,
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
          expMonth: parseInt(result.card.dateExpiryMonth, 10),
          expYear: parseInt('20' + result.card.dateExpiryYear, 10),
        } : undefined,
        failureCode: isSuccess ? undefined : result.reCo,
        failureMessage: isSuccess ? undefined : result.responseText,
        rawResponse: result,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Windcave] Request failed:', message);

      return {
        success: false,
        transactionId: '',
        status: 'failed',
        failureCode: 'network_error',
        failureMessage: message,
        rawResponse: error,
      };
    }
  },

  // Capture doesn't need card data - just transaction ID
  async capture(
    transactionId: string,
    credentials: WindcaveCredentials,
    amount?: number
  ): Promise<AuthorizeResponse> {
    const baseUrl = getBaseUrl(credentials.environment);

    const requestBody: Record<string, unknown> = {
      type: 'complete',
      transactionId,
    };

    if (amount !== undefined) {
      requestBody.amount = (amount / 100).toFixed(2);
    }

    // Direct call - no token needed for capture
    const response = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(credentials),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
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
  },

  // Refund doesn't need card data
  async refund(
    transactionId: string,
    amount: number,
    credentials: WindcaveCredentials,
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = getBaseUrl(credentials.environment);

    const response = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(credentials),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'refund',
        amount: (amount / 100).toFixed(2),
        transactionId,
        merchantReference: idempotencyKey,
      }),
    });

    const result = await response.json();
    const isSuccess = result.authorised === true;

    return {
      success: isSuccess,
      transactionId: result.id,
      status: isSuccess ? 'captured' : 'failed',
      failureCode: isSuccess ? undefined : result.reCo,
      failureMessage: isSuccess ? undefined : result.responseText,
      rawResponse: result,
    };
  },
};

// =============================================================================
// Helpers
// =============================================================================

interface WindcaveAPIResponse {
  id: string;
  authorised: boolean;
  authCode?: string;
  reCo?: string;
  responseText?: string;
  card?: {
    type: string;
    cardNumber: string;
    dateExpiryMonth: string;
    dateExpiryYear: string;
  };
  links?: Array<{ rel: string; href: string }>;
}

function mapCardBrand(cardType?: string): string {
  if (!cardType) return 'unknown';
  const brandMap: Record<string, string> = {
    visa: 'visa',
    mastercard: 'mastercard',
    amex: 'amex',
    'american express': 'amex',
    diners: 'diners',
    discover: 'discover',
    jcb: 'jcb',
    unionpay: 'unionpay',
  };
  return brandMap[cardType.toLowerCase()] || cardType;
}

export default windcaveAdapter;
