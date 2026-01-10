/**
 * PSP Helper - Build PSP Requests with Token Placeholders
 *
 * This module provides helpers for PSP adapters to build request
 * bodies that work with any vault provider (BT, VGS, Atlas CDE).
 *
 * The helpers use provider-agnostic placeholders (__CARD_NUMBER__, etc.)
 * that get replaced with the appropriate format by the proxy provider.
 *
 * @example
 * ```typescript
 * import { buildCardPayload, forwardToPSP } from '@/lib/vault/psp-helper';
 *
 * // Build Windcave-format payload
 * const payload = {
 *   type: 'purchase',
 *   amount: '99.99',
 *   card: buildCardPayload('windcave'),
 * };
 *
 * // Forward to PSP
 * const result = await forwardToPSP({
 *   psp: 'windcave',
 *   tokenId: 'tok_xxx',
 *   destination: 'https://sec.windcave.com/api/v1/transactions',
 *   payload,
 *   headers: { 'Authorization': 'Basic xxx' },
 * });
 * ```
 */

import { getProxy } from './index';
import type { ProxyResponse } from './types';

// =============================================================================
// Card Placeholders (Provider Agnostic)
// =============================================================================

/**
 * Placeholder constants used in PSP request bodies
 * These get replaced by the proxy provider with actual values or their format
 */
export const CARD = {
  NUMBER: '__CARD_NUMBER__',
  EXP_MONTH: '__CARD_EXP_MONTH__',
  EXP_YEAR: '__CARD_EXP_YEAR__',
  EXP_YEAR_2: '__CARD_EXP_YEAR_2__',  // 2-digit year
  CVC: '__CARD_CVC__',
  HOLDER_NAME: '__CARD_HOLDER_NAME__',
} as const;

// =============================================================================
// PSP-Specific Card Formats
// =============================================================================

type PSPName =
  | 'stripe'
  | 'adyen'
  | 'braintree'
  | 'windcave'
  | 'checkoutcom'
  | 'authorizenet'
  | 'chase'
  | 'nuvei'
  | 'dlocal'
  | 'airwallex';

interface CardPayloadOptions {
  includeHolderName?: boolean;
  includeCvc?: boolean;
}

/**
 * Build a card payload in the format expected by a specific PSP
 */
export function buildCardPayload(
  psp: PSPName,
  options: CardPayloadOptions = {}
): Record<string, unknown> {
  const { includeHolderName = true, includeCvc = true } = options;

  switch (psp) {
    case 'stripe':
      return {
        number: CARD.NUMBER,
        exp_month: CARD.EXP_MONTH,
        exp_year: CARD.EXP_YEAR,
        ...(includeCvc && { cvc: CARD.CVC }),
        ...(includeHolderName && { name: CARD.HOLDER_NAME }),
      };

    case 'adyen':
      return {
        type: 'scheme',
        number: CARD.NUMBER,
        expiryMonth: CARD.EXP_MONTH,
        expiryYear: CARD.EXP_YEAR,
        ...(includeCvc && { cvc: CARD.CVC }),
        ...(includeHolderName && { holderName: CARD.HOLDER_NAME }),
      };

    case 'braintree':
      return {
        creditCard: {
          number: CARD.NUMBER,
          expirationMonth: CARD.EXP_MONTH,
          expirationYear: CARD.EXP_YEAR,
          ...(includeCvc && { cvv: CARD.CVC }),
          ...(includeHolderName && { cardholderName: CARD.HOLDER_NAME }),
        },
      };

    case 'windcave':
      return {
        cardNumber: CARD.NUMBER,
        dateExpiryMonth: CARD.EXP_MONTH,
        dateExpiryYear: CARD.EXP_YEAR_2,  // Windcave uses 2-digit year
        ...(includeCvc && { cvc2: CARD.CVC }),
        ...(includeHolderName && { cardHolderName: CARD.HOLDER_NAME }),
      };

    case 'checkoutcom':
      return {
        type: 'card',
        number: CARD.NUMBER,
        expiry_month: parseInt(CARD.EXP_MONTH, 10),
        expiry_year: parseInt(CARD.EXP_YEAR, 10),
        ...(includeCvc && { cvv: CARD.CVC }),
        ...(includeHolderName && { name: CARD.HOLDER_NAME }),
      };

    case 'authorizenet':
      return {
        cardNumber: CARD.NUMBER,
        expirationDate: `${CARD.EXP_MONTH}${CARD.EXP_YEAR_2}`, // MMYY format
        ...(includeCvc && { cardCode: CARD.CVC }),
      };

    case 'chase':
      return {
        accountNumber: CARD.NUMBER,
        expirationDate: `${CARD.EXP_MONTH}${CARD.EXP_YEAR_2}`,
        ...(includeCvc && { cvv: CARD.CVC }),
      };

    case 'nuvei':
      return {
        cardNumber: CARD.NUMBER,
        expirationMonth: CARD.EXP_MONTH,
        expirationYear: CARD.EXP_YEAR_2,
        ...(includeCvc && { CVV: CARD.CVC }),
        ...(includeHolderName && { cardHolderName: CARD.HOLDER_NAME }),
      };

    case 'dlocal':
      return {
        card: {
          card_number: CARD.NUMBER,
          expiration_month: parseInt(CARD.EXP_MONTH, 10),
          expiration_year: parseInt(CARD.EXP_YEAR, 10),
          ...(includeCvc && { security_code: CARD.CVC }),
          ...(includeHolderName && { holder_name: CARD.HOLDER_NAME }),
        },
      };

    case 'airwallex':
      return {
        card: {
          number: CARD.NUMBER,
          expiry_month: CARD.EXP_MONTH,
          expiry_year: CARD.EXP_YEAR,
          ...(includeCvc && { cvc: CARD.CVC }),
          ...(includeHolderName && { name: CARD.HOLDER_NAME }),
        },
      };

    default:
      throw new Error(`Unknown PSP: ${psp}`);
  }
}

// =============================================================================
// Forward to PSP
// =============================================================================

interface ForwardToPSPRequest {
  psp: PSPName;
  tokenId: string;
  destination: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  payload: unknown;
  headers: Record<string, string>;
  timeout?: number;
}

/**
 * Forward a request to a PSP through the vault proxy
 * Token placeholders in the payload get replaced with real card data
 */
export async function forwardToPSP<T = unknown>(
  request: ForwardToPSPRequest
): Promise<ProxyResponse<T>> {
  const proxy = getProxy();

  return proxy.forward<T>({
    destination: request.destination,
    method: request.method || 'POST',
    headers: request.headers,
    body: request.payload,
    tokenId: request.tokenId,
    timeout: request.timeout,
  });
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Build a complete PSP authorization request
 */
export function buildAuthRequest(
  psp: PSPName,
  params: {
    amount: number;
    currency: string;
    merchantReference?: string;
    capture?: boolean;
    metadata?: Record<string, string>;
  }
): Record<string, unknown> {
  const cardPayload = buildCardPayload(psp);

  switch (psp) {
    case 'stripe':
      return {
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        card: cardPayload,
        capture: params.capture ?? true,
        metadata: params.metadata,
      };

    case 'adyen':
      return {
        amount: {
          value: params.amount,
          currency: params.currency.toUpperCase(),
        },
        paymentMethod: cardPayload,
        reference: params.merchantReference,
        merchantAccount: '__MERCHANT_ACCOUNT__', // Filled by adapter
      };

    case 'windcave':
      return {
        type: params.capture ? 'purchase' : 'auth',
        amount: (params.amount / 100).toFixed(2),
        currency: params.currency.toUpperCase(),
        merchantReference: params.merchantReference,
        card: cardPayload,
      };

    // Add other PSPs as needed...

    default:
      return {
        amount: params.amount,
        currency: params.currency,
        card: cardPayload,
        ...params.metadata,
      };
  }
}
