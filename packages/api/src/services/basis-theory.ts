// ============================================
// Basis Theory Integration Service
// Handles card tokenization and secure card data
// ============================================

import type { CardData, TokenizedCard } from '../types'

interface BasisTheoryConfig {
  publicKey: string
  privateKey: string
  environment: 'test' | 'live'
}

interface TokenIntent {
  id: string
  type: string
  tenant_id: string
  expires_at: string
}

interface BasisTheoryToken {
  id: string
  type: string
  data: {
    number: string
    expiration_month: number
    expiration_year: number
  }
  metadata?: Record<string, string>
  created_at: string
  mask: {
    number: string
    expiration_month: number
    expiration_year: number
  }
}

export class BasisTheoryService {
  private config: BasisTheoryConfig
  private baseUrl = 'https://api.basistheory.com'

  constructor(config: BasisTheoryConfig) {
    this.config = config
  }

  private getHeaders(usePrivateKey = true): HeadersInit {
    return {
      'BT-API-KEY': usePrivateKey ? this.config.privateKey : this.config.publicKey,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Create a token intent for collecting card data on the frontend
   * Token intents are short-lived and can only be used once
   */
  async createTokenIntent(): Promise<TokenIntent> {
    const response = await fetch(`${this.baseUrl}/token-intents`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        type: 'card',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to create token intent: ${error.message || response.statusText}`)
    }

    return response.json()
  }

  /**
   * Convert a token intent to a permanent token
   * Called after the frontend collects card data
   */
  async convertIntentToToken(intentId: string): Promise<TokenizedCard> {
    const response = await fetch(`${this.baseUrl}/token-intents/${intentId}/convert`, {
      method: 'POST',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to convert token intent: ${error.message || response.statusText}`)
    }

    const token: BasisTheoryToken = await response.json()

    return {
      id: token.id,
      brand: this.detectCardBrand(token.mask.number),
      last4: token.mask.number.slice(-4),
      exp_month: token.mask.expiration_month,
      exp_year: token.mask.expiration_year,
    }
  }

  /**
   * Tokenize card data directly (for server-side use only)
   * Requires PCI DSS compliance
   */
  async tokenizeCard(card: CardData): Promise<TokenizedCard> {
    const response = await fetch(`${this.baseUrl}/tokens`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        type: 'card',
        data: {
          number: card.number,
          expiration_month: card.exp_month,
          expiration_year: card.exp_year,
          cvc: card.cvc,
        },
        metadata: card.name ? { cardholder_name: card.name } : undefined,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to tokenize card: ${error.message || response.statusText}`)
    }

    const token: BasisTheoryToken = await response.json()

    return {
      id: token.id,
      brand: this.detectCardBrand(token.mask.number),
      last4: token.mask.number.slice(-4),
      exp_month: token.mask.expiration_month,
      exp_year: token.mask.expiration_year,
    }
  }

  /**
   * Get token details (masked data only)
   */
  async getToken(tokenId: string): Promise<TokenizedCard> {
    const response = await fetch(`${this.baseUrl}/tokens/${tokenId}`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to get token: ${error.message || response.statusText}`)
    }

    const token: BasisTheoryToken = await response.json()

    return {
      id: token.id,
      brand: this.detectCardBrand(token.mask.number),
      last4: token.mask.number.slice(-4),
      exp_month: token.mask.expiration_month,
      exp_year: token.mask.expiration_year,
    }
  }

  /**
   * Delete a token
   */
  async deleteToken(tokenId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/tokens/${tokenId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to delete token: ${error.message || response.statusText}`)
    }
  }

  /**
   * Create a proxy to forward tokenized card data to a PSP
   */
  async createProxy(config: {
    name: string
    destination_url: string
    request_transform?: {
      code: string
    }
  }): Promise<{ id: string; key: string }> {
    const response = await fetch(`${this.baseUrl}/proxies`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        name: config.name,
        destination_url: config.destination_url,
        request_transform: config.request_transform,
        require_auth: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to create proxy: ${error.message || response.statusText}`)
    }

    return response.json()
  }

  /**
   * Invoke a proxy to send tokenized data to a PSP
   */
  async invokeProxy(proxyKey: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/proxy`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'BT-PROXY-KEY': proxyKey,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Proxy invocation failed: ${error.message || response.statusText}`)
    }

    return response.json()
  }

  /**
   * Create a Reactor for processing card data
   * Reactors are serverless functions that can access raw card data
   */
  async createReactor(config: {
    name: string
    code: string
  }): Promise<{ id: string }> {
    const response = await fetch(`${this.baseUrl}/reactors`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        name: config.name,
        code: config.code,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to create reactor: ${error.message || response.statusText}`)
    }

    return response.json()
  }

  /**
   * Invoke a Reactor
   */
  async invokeReactor(
    reactorId: string,
    args: Record<string, unknown>
  ): Promise<{ raw: unknown }> {
    const response = await fetch(`${this.baseUrl}/reactors/${reactorId}/react`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ args }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Reactor invocation failed: ${error.message || response.statusText}`)
    }

    return response.json()
  }

  /**
   * Detect card brand from card number
   */
  private detectCardBrand(number: string): string {
    const sanitized = number.replace(/\D/g, '')

    if (/^4/.test(sanitized)) return 'visa'
    if (/^5[1-5]/.test(sanitized) || /^2[2-7]/.test(sanitized)) return 'mastercard'
    if (/^3[47]/.test(sanitized)) return 'amex'
    if (/^6(?:011|5)/.test(sanitized)) return 'discover'
    if (/^3(?:0[0-5]|[68])/.test(sanitized)) return 'diners'
    if (/^35(?:2[89]|[3-8])/.test(sanitized)) return 'jcb'
    if (/^62/.test(sanitized)) return 'unionpay'

    return 'unknown'
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now()

    try {
      const response = await fetch(`${this.baseUrl}/ping`, {
        headers: this.getHeaders(),
      })

      return {
        healthy: response.ok,
        latency_ms: Date.now() - start,
      }
    } catch {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
      }
    }
  }
}

/**
 * Reactor code template for processing payments through PSPs
 * This code runs inside Basis Theory's secure environment
 */
export const PAYMENT_REACTOR_CODE = `
module.exports = async function (req) {
  const { bt, args } = req;
  const { token_id, psp, psp_endpoint, amount, currency, idempotency_key } = args;

  // Get the raw card data
  const token = await bt.tokens.retrieve(token_id);
  const card = token.data;

  // Build PSP-specific payload
  let payload;
  let headers;

  switch (psp) {
    case 'stripe':
      // Create payment method and charge
      payload = new URLSearchParams({
        'card[number]': card.number,
        'card[exp_month]': card.expiration_month,
        'card[exp_year]': card.expiration_year,
        'card[cvc]': card.cvc,
      });
      headers = {
        'Authorization': 'Bearer ' + args.api_key,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      break;

    case 'adyen':
      payload = JSON.stringify({
        paymentMethod: {
          type: 'scheme',
          number: card.number,
          expiryMonth: card.expiration_month.toString().padStart(2, '0'),
          expiryYear: card.expiration_year.toString(),
          cvc: card.cvc,
        },
        amount: { value: amount, currency },
        reference: idempotency_key,
        merchantAccount: args.merchant_account,
      });
      headers = {
        'X-API-Key': args.api_key,
        'Content-Type': 'application/json',
      };
      break;

    default:
      throw new Error('Unsupported PSP: ' + psp);
  }

  // Make the request to the PSP
  const response = await fetch(psp_endpoint, {
    method: 'POST',
    headers,
    body: payload,
  });

  return {
    raw: await response.json(),
    status: response.status,
  };
};
`
