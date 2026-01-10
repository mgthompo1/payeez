/**
 * Basis Theory Vault Provider
 *
 * Uses Basis Theory for:
 * - Card tokenization (via their Elements on frontend)
 * - Token storage (their vault)
 * - PSP forwarding (their proxy)
 *
 * This keeps Atlas out of PCI scope.
 */

import type {
  VaultProvider,
  ProxyProvider,
  TokenMetadata,
  PublicConfig,
  ProxyRequest,
  ProxyResponse,
  CardBrand,
} from '../types';

// =============================================================================
// Configuration (from environment - admin controlled)
// =============================================================================

interface BasisTheoryConfig {
  publicKey: string;      // BT public API key (for Elements)
  privateKey: string;     // BT private API key (for server-side ops)
  proxyUrl: string;       // BT proxy endpoint
  apiUrl: string;         // BT API endpoint
}

function getConfig(): BasisTheoryConfig {
  const publicKey = process.env.BT_PUBLIC_KEY || Deno?.env?.get?.('BT_PUBLIC_KEY');
  const privateKey = process.env.BT_PRIVATE_KEY || Deno?.env?.get?.('BT_PRIVATE_KEY');

  if (!publicKey || !privateKey) {
    throw new Error('Basis Theory credentials not configured. Set BT_PUBLIC_KEY and BT_PRIVATE_KEY.');
  }

  return {
    publicKey,
    privateKey,
    proxyUrl: 'https://api.basistheory.com/proxy',
    apiUrl: 'https://api.basistheory.com',
  };
}

// =============================================================================
// Vault Provider Implementation
// =============================================================================

export class BasisTheoryVault implements VaultProvider {
  readonly name = 'basis_theory' as const;
  private config: BasisTheoryConfig;

  constructor() {
    this.config = getConfig();
  }

  getPublicConfig(): PublicConfig {
    return {
      provider: 'basis_theory',
      publicKey: this.config.publicKey,
      elementsUrl: 'https://js.basistheory.com',
      options: {
        // BT-specific options for Elements
        style: {
          // Default styles - can be overridden by frontend
        },
      },
    };
  }

  async getToken(tokenId: string): Promise<TokenMetadata | null> {
    try {
      const response = await fetch(`${this.config.apiUrl}/tokens/${tokenId}`, {
        headers: {
          'BT-API-KEY': this.config.privateKey,
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`BT API error: ${response.status}`);
      }

      const token = await response.json();
      return this.mapTokenResponse(token);
    } catch (error) {
      console.error('[BasisTheory] Failed to get token:', error);
      return null;
    }
  }

  async deleteToken(tokenId: string): Promise<void> {
    const response = await fetch(`${this.config.apiUrl}/tokens/${tokenId}`, {
      method: 'DELETE',
      headers: {
        'BT-API-KEY': this.config.privateKey,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`BT API error: ${response.status}`);
    }
  }

  async validateToken(tokenId: string): Promise<boolean> {
    const token = await this.getToken(tokenId);
    if (!token) return false;

    // Check if expired
    if (token.expiresAt && token.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  private mapTokenResponse(btToken: any): TokenMetadata {
    const data = btToken.data || {};

    return {
      id: btToken.id,
      fingerprint: btToken.fingerprint || '',
      brand: this.mapCardBrand(data.brand || data.card_brand),
      last4: data.last4 || data.number?.slice(-4) || '',
      expirationMonth: parseInt(data.expiration_month || data.exp_month || '0', 10),
      expirationYear: parseInt(data.expiration_year || data.exp_year || '0', 10),
      cardholderName: data.cardholder_name || data.name,
      createdAt: new Date(btToken.created_at),
      expiresAt: btToken.expires_at ? new Date(btToken.expires_at) : undefined,
    };
  }

  private mapCardBrand(brand?: string): CardBrand {
    if (!brand) return 'unknown';
    const normalized = brand.toLowerCase();
    const brandMap: Record<string, CardBrand> = {
      visa: 'visa',
      mastercard: 'mastercard',
      'master card': 'mastercard',
      amex: 'amex',
      'american express': 'amex',
      discover: 'discover',
      diners: 'diners',
      'diners club': 'diners',
      jcb: 'jcb',
      unionpay: 'unionpay',
      'union pay': 'unionpay',
    };
    return brandMap[normalized] || 'unknown';
  }
}

// =============================================================================
// Proxy Provider Implementation
// =============================================================================

export class BasisTheoryProxy implements ProxyProvider {
  readonly name = 'basis_theory' as const;
  private config: BasisTheoryConfig;

  constructor() {
    this.config = getConfig();
  }

  async forward<T = unknown>(request: ProxyRequest): Promise<ProxyResponse<T>> {
    const startTime = Date.now();

    // Build the request body with BT token placeholders
    const body = this.injectTokenPlaceholders(request.body, request.tokenId);

    const response = await fetch(this.config.proxyUrl, {
      method: 'POST',
      headers: {
        'BT-API-KEY': this.config.privateKey,
        'BT-PROXY-URL': request.destination,
        'BT-PROXY-METHOD': request.method,
        'Content-Type': 'application/json',
        // Forward custom headers
        ...Object.fromEntries(
          Object.entries(request.headers).map(([k, v]) => [`BT-PROXY-HEADER-${k}`, v])
        ),
      },
      body: JSON.stringify(body),
      signal: request.timeout ? AbortSignal.timeout(request.timeout) : undefined,
    });

    const latencyMs = Date.now() - startTime;
    const data = await response.json() as T;

    // Extract response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      headers,
      data,
      latencyMs,
    };
  }

  /**
   * Replace card field references with BT token placeholders
   */
  private injectTokenPlaceholders(body: unknown, tokenId: string): unknown {
    if (!body || typeof body !== 'object') return body;

    const json = JSON.stringify(body);

    // Replace our internal placeholder format with BT format
    // __CARD_NUMBER__ -> {{ tokenId | json: '$.number' }}
    const replacements: Record<string, string> = {
      '__CARD_NUMBER__': `{{ ${tokenId} | json: '$.number' }}`,
      '__CARD_EXP_MONTH__': `{{ ${tokenId} | json: '$.expiration_month' }}`,
      '__CARD_EXP_YEAR__': `{{ ${tokenId} | json: '$.expiration_year' }}`,
      '__CARD_CVC__': `{{ ${tokenId} | json: '$.cvc' }}`,
      '__CARD_HOLDER_NAME__': `{{ ${tokenId} | json: '$.cardholder_name' }}`,
    };

    let result = json;
    for (const [placeholder, btFormat] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'g'), btFormat);
    }

    return JSON.parse(result);
  }
}

// =============================================================================
// Exports
// =============================================================================

export function createBasisTheoryVault(): VaultProvider {
  return new BasisTheoryVault();
}

export function createBasisTheoryProxy(): ProxyProvider {
  return new BasisTheoryProxy();
}
