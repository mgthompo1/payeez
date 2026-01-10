/**
 * Atlas CDE Vault Provider
 *
 * This provider uses Atlas's own card tokenization infrastructure.
 * Currently stores encrypted card data in Supabase with AES-256-GCM encryption.
 *
 * This IS in PCI scope but is the current working implementation.
 * Can be swapped to basis_theory provider to exit PCI scope.
 *
 * Current flow:
 * 1. Atlas Elements (frontend) collects card data
 * 2. POST /api/tokenize encrypts and stores in Supabase tokens table
 * 3. PSP adapters call this provider to decrypt and get card data
 * 4. Adapter sends decrypted data to PSP
 */

import type {
  VaultProvider,
  ProxyProvider,
  TokenMetadata,
  PublicConfig,
  CreateTokenOptions,
  CardData,
  ProxyRequest,
  ProxyResponse,
  CardBrand,
} from '../types';

// =============================================================================
// Encryption (matches packages/elements/src/lib/encryption.ts)
// =============================================================================

type Encrypted = { v: 1; iv: string; ct: string; tag: string; kid?: string };

function b64url(buf: Uint8Array): string {
  // Works in both Node and Deno
  const b64 = typeof Buffer !== 'undefined'
    ? Buffer.from(buf).toString('base64')
    : btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64');
  } else {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(secret);

  // SHA-256 hash to get 32 bytes
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial);

  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function decryptCardData(enc: Encrypted, masterKey: string, aad?: string): Promise<string> {
  const key = await deriveKey(masterKey);
  const iv = fromB64url(enc.iv);
  const ct = fromB64url(enc.ct);
  const tag = fromB64url(enc.tag);

  // Combine ciphertext and tag for WebCrypto
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct);
  combined.set(tag, ct.length);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad ? new TextEncoder().encode(aad) : undefined,
      tagLength: 128,
    },
    key,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

// =============================================================================
// Configuration
// =============================================================================

interface AtlasCDEConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  elementsUrl: string;
  masterKey: string;
}

function getConfig(): AtlasCDEConfig {
  // Support both Node.js and Deno environments
  const getEnv = (key: string): string | undefined => {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
    if (typeof Deno !== 'undefined') {
      return Deno.env.get(key);
    }
    return undefined;
  };

  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const elementsUrl = getEnv('ATLAS_ELEMENTS_URL') || getEnv('NEXT_PUBLIC_ELEMENTS_URL');
  const masterKey = getEnv('ATLAS_MASTER_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Atlas CDE requires Supabase configuration. ' +
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return {
    supabaseUrl,
    supabaseServiceKey,
    elementsUrl: elementsUrl || '',
    masterKey: masterKey || '',
  };
}

// =============================================================================
// Supabase Client (lightweight, no SDK dependency)
// =============================================================================

async function supabaseQuery<T>(
  config: AtlasCDEConfig,
  table: string,
  query: string
): Promise<T | null> {
  const url = `${config.supabaseUrl}/rest/v1/${table}?${query}`;

  const response = await fetch(url, {
    headers: {
      'apikey': config.supabaseServiceKey,
      'Authorization': `Bearer ${config.supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`[AtlasCDE] Supabase query failed: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

// =============================================================================
// Vault Provider Implementation
// =============================================================================

export class AtlasCDEVault implements VaultProvider {
  readonly name = 'atlas' as const;
  private config: AtlasCDEConfig;

  constructor() {
    this.config = getConfig();
  }

  getPublicConfig(): PublicConfig {
    return {
      provider: 'atlas',
      publicKey: '', // Atlas Elements doesn't need a public key
      elementsUrl: this.config.elementsUrl,
      options: {},
    };
  }

  async getToken(tokenId: string): Promise<TokenMetadata | null> {
    // Token ID format: tok_xxx or just the UUID
    const vaultTokenId = tokenId.startsWith('tok_') ? tokenId : `tok_${tokenId}`;

    const token = await supabaseQuery<TokenRecord>(
      this.config,
      'tokens',
      `vault_token_id=eq.${vaultTokenId}&is_active=eq.true&select=*`
    );

    if (!token) return null;

    return {
      id: token.vault_token_id,
      fingerprint: token.id, // Use DB ID as fingerprint
      brand: (token.card_brand || 'unknown') as CardBrand,
      last4: token.card_last4 || '',
      expirationMonth: token.card_exp_month || 0,
      expirationYear: token.card_exp_year || 0,
      cardholderName: token.card_holder_name || undefined,
      createdAt: new Date(token.created_at),
      expiresAt: token.expires_at ? new Date(token.expires_at) : undefined,
    };
  }

  async deleteToken(tokenId: string): Promise<void> {
    const vaultTokenId = tokenId.startsWith('tok_') ? tokenId : `tok_${tokenId}`;

    await fetch(
      `${this.config.supabaseUrl}/rest/v1/tokens?vault_token_id=eq.${vaultTokenId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': this.config.supabaseServiceKey,
          'Authorization': `Bearer ${this.config.supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: false }),
      }
    );
  }

  async validateToken(tokenId: string): Promise<boolean> {
    const token = await this.getToken(tokenId);
    if (!token) return false;
    if (token.expiresAt && token.expiresAt < new Date()) return false;
    return true;
  }

  /**
   * Decrypt and retrieve full card data
   * THIS IS THE PCI-SENSITIVE OPERATION
   * Only call this when actually submitting to a PSP
   */
  async getDecryptedCard(tokenId: string): Promise<CardData | null> {
    const vaultTokenId = tokenId.startsWith('tok_') ? tokenId : `tok_${tokenId}`;

    const token = await supabaseQuery<TokenRecord>(
      this.config,
      'tokens',
      `vault_token_id=eq.${vaultTokenId}&is_active=eq.true&select=*`
    );

    if (!token || !token.encrypted_card_data) {
      console.error(`[AtlasCDE] Token not found or no encrypted data: ${vaultTokenId}`);
      return null;
    }

    try {
      // Parse encrypted data
      const encrypted: Encrypted = JSON.parse(token.encrypted_card_data);

      // Decrypt using AAD if present
      const decrypted = await decryptCardData(
        encrypted,
        this.config.masterKey,
        token.encryption_aad || undefined
      );

      const cardData = JSON.parse(decrypted);

      return {
        number: cardData.pan || cardData.number,
        expirationMonth: cardData.expiryMonth || cardData.expiration_month,
        expirationYear: cardData.expiryYear || cardData.expiration_year,
        cvc: cardData.cvc,
        cardholderName: cardData.cardHolderName || cardData.cardholder_name,
      };
    } catch (error) {
      console.error('[AtlasCDE] Failed to decrypt card data:', error);
      return null;
    }
  }
}

// =============================================================================
// Proxy Provider Implementation
// =============================================================================

export class AtlasCDEProxy implements ProxyProvider {
  readonly name = 'atlas' as const;
  private vault: AtlasCDEVault;

  constructor() {
    this.vault = new AtlasCDEVault();
  }

  /**
   * Forward request to PSP with card data substitution
   *
   * Unlike BT/VGS, Atlas CDE decrypts the card data and makes
   * the PSP request directly (no external proxy)
   */
  async forward<T = unknown>(request: ProxyRequest): Promise<ProxyResponse<T>> {
    const startTime = Date.now();

    // Get decrypted card data
    const cardData = await this.vault.getDecryptedCard(request.tokenId);
    if (!cardData) {
      throw new Error(`Failed to decrypt card data for token: ${request.tokenId}`);
    }

    // Replace placeholders in the request body
    const body = this.substituteCardData(request.body, cardData);

    // Make direct request to PSP
    const response = await fetch(request.destination, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...request.headers,
      },
      body: JSON.stringify(body),
      signal: request.timeout ? AbortSignal.timeout(request.timeout) : undefined,
    });

    const latencyMs = Date.now() - startTime;
    const data = await response.json() as T;

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
   * Replace card placeholders with actual values
   */
  private substituteCardData(body: unknown, card: CardData): unknown {
    if (!body || typeof body !== 'object') return body;

    const json = JSON.stringify(body);

    // Format expiry year as 2 or 4 digits based on placeholder
    const expYear2 = String(card.expirationYear).slice(-2);
    const expYear4 = card.expirationYear.length === 2
      ? `20${card.expirationYear}`
      : card.expirationYear;

    const replacements: Record<string, string> = {
      '__CARD_NUMBER__': card.number,
      '__CARD_EXP_MONTH__': String(card.expirationMonth).padStart(2, '0'),
      '__CARD_EXP_YEAR__': expYear4,
      '__CARD_EXP_YEAR_2__': expYear2,
      '__CARD_CVC__': card.cvc,
      '__CARD_HOLDER_NAME__': card.cardholderName || '',
    };

    let result = json;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    return JSON.parse(result);
  }
}

// =============================================================================
// Types
// =============================================================================

interface TokenRecord {
  id: string;
  tenant_id: string;
  vault_provider: string;
  vault_token_id: string;
  encrypted_card_data: string | null;
  encryption_aad: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  card_holder_name: string | null;
  session_id: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// =============================================================================
// Exports
// =============================================================================

export function createAtlasCDEVault(): VaultProvider {
  return new AtlasCDEVault();
}

export function createAtlasCDEProxy(): ProxyProvider {
  return new AtlasCDEProxy();
}

// Export the class for direct access to getDecryptedCard
export { AtlasCDEVault as AtlasVault };
