/**
 * Atlas Vault Provider Abstraction
 *
 * This abstraction allows swapping between:
 * - Basis Theory (Phase 1: Stay out of PCI scope)
 * - VGS (Alternative: Stay out of PCI scope)
 * - Atlas CDE (Phase 3: Own PCI-compliant infrastructure)
 *
 * The interface is the same regardless of provider.
 */

// =============================================================================
// Token Types
// =============================================================================

export interface CardData {
  number: string;
  expirationMonth: string;  // MM
  expirationYear: string;   // YYYY or YY
  cvc: string;
  cardholderName?: string;
}

export interface TokenMetadata {
  id: string;
  fingerprint: string;      // For dedup across tokens
  brand: CardBrand;
  last4: string;
  expirationMonth: number;
  expirationYear: number;
  cardholderName?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'diners'
  | 'jcb'
  | 'unionpay'
  | 'unknown';

// =============================================================================
// Provider Interface
// =============================================================================

export interface VaultProvider {
  readonly name: 'basis_theory' | 'vgs' | 'atlas';

  /**
   * Get the public key/config for frontend Elements
   * This is used to initialize the secure card capture
   */
  getPublicConfig(): PublicConfig;

  /**
   * Create a token from card data
   * Only used in CDE context - BT/VGS handle this client-side
   */
  createToken?(cardData: CardData, options?: CreateTokenOptions): Promise<TokenMetadata>;

  /**
   * Get token metadata (without sensitive data)
   */
  getToken(tokenId: string): Promise<TokenMetadata | null>;

  /**
   * Delete/expire a token
   */
  deleteToken(tokenId: string): Promise<void>;

  /**
   * Check if a token is valid/active
   */
  validateToken(tokenId: string): Promise<boolean>;
}

export interface PublicConfig {
  provider: 'basis_theory' | 'vgs' | 'atlas';
  publicKey: string;
  elementsUrl?: string;
  options?: Record<string, unknown>;
}

export interface CreateTokenOptions {
  tenantId: string;
  sessionId?: string;
  expiresIn?: number;  // seconds
  metadata?: Record<string, string>;
}

// =============================================================================
// Proxy Interface (for PSP forwarding)
// =============================================================================

export interface ProxyProvider {
  readonly name: 'basis_theory' | 'vgs' | 'atlas';

  /**
   * Forward a request to a PSP with token detokenization
   * The request body can contain token placeholders that get replaced
   */
  forward<T = unknown>(request: ProxyRequest): Promise<ProxyResponse<T>>;
}

export interface ProxyRequest {
  /** Destination URL (e.g., https://sec.windcave.com/api/v1/transactions) */
  destination: string;

  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /** Headers to forward (auth headers, content-type, etc.) */
  headers: Record<string, string>;

  /** Request body with token placeholders */
  body?: unknown;

  /** Token ID to use for detokenization */
  tokenId: string;

  /** Timeout in milliseconds */
  timeout?: number;
}

export interface ProxyResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
  /** Time taken for the proxy request */
  latencyMs: number;
}

// =============================================================================
// Token Placeholder Helpers
// =============================================================================

/**
 * Generate token placeholder for Basis Theory proxy
 * e.g., {{ tok_xxx | json: '$.number' }}
 */
export function btPlaceholder(tokenId: string, field: CardField): string {
  const fieldMap: Record<CardField, string> = {
    number: '$.number',
    expirationMonth: '$.expiration_month',
    expirationYear: '$.expiration_year',
    cvc: '$.cvc',
    cardholderName: '$.cardholder_name',
  };
  return `{{ ${tokenId} | json: '${fieldMap[field]}' }}`;
}

/**
 * Generate token placeholder for VGS proxy
 */
export function vgsPlaceholder(aliasId: string, field: CardField): string {
  // VGS uses a different format
  return `{{${aliasId}.${field}}}`;
}

/**
 * Generate placeholder based on current provider
 */
export function tokenPlaceholder(
  provider: 'basis_theory' | 'vgs' | 'atlas',
  tokenId: string,
  field: CardField
): string {
  switch (provider) {
    case 'basis_theory':
      return btPlaceholder(tokenId, field);
    case 'vgs':
      return vgsPlaceholder(tokenId, field);
    case 'atlas':
      // Atlas CDE will detokenize server-side, not via placeholders
      // This returns a special marker that Atlas CDE recognizes
      return `__ATLAS_TOKEN__:${tokenId}:${field}`;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export type CardField =
  | 'number'
  | 'expirationMonth'
  | 'expirationYear'
  | 'cvc'
  | 'cardholderName';
