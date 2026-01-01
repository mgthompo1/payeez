// ============================================
// VGS (Very Good Security) Vault Adapter
// Alternative vault provider to Basis Theory
// ============================================

/**
 * VGS Authentication Configuration
 * Supports both OAuth (preferred) and Basic Auth (legacy)
 */
export interface VGSAuthConfig {
  type: 'oauth' | 'basic';
  // OAuth credentials
  clientId?: string;
  clientSecret?: string;
  // Legacy Basic auth (deprecated - migrate to OAuth)
  accessCredentials?: string;
}

export interface VGSConfig {
  vaultId: string;
  environment: 'sandbox' | 'live';
  auth: VGSAuthConfig;
}

export interface VGSTokenizeResponse {
  tokenId: string;
  cardBrand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
}

// Token cache for OAuth tokens
interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

/**
 * VGS Vault Adapter
 * Handles card tokenization and proxy requests through VGS
 * Uses OAuth for authentication (preferred) or Basic Auth (legacy)
 */
export class VGSVault {
  private config: VGSConfig;
  private baseUrl: string;
  private oauthBaseUrl: string;

  constructor(config: VGSConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'live'
      ? `https://${config.vaultId}.live.verygoodproxy.com`
      : `https://${config.vaultId}.sandbox.verygoodproxy.com`;
    this.oauthBaseUrl = config.environment === 'live'
      ? 'https://auth.verygoodsecurity.com'
      : 'https://auth.sandbox.verygoodsecurity.com';
  }

  /**
   * Get OAuth access token with caching
   * Tokens are cached until 5 minutes before expiry
   */
  private async getOAuthToken(): Promise<string> {
    const auth = this.config.auth;

    if (auth.type !== 'oauth' || !auth.clientId || !auth.clientSecret) {
      throw new Error('[Security] OAuth credentials not configured');
    }

    // Check cache (with 5 minute buffer before expiry)
    const now = Date.now();
    if (tokenCache && tokenCache.expiresAt > now + 300000) {
      return tokenCache.accessToken;
    }

    // Request new token
    const response = await fetch(`${this.oauthBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        scope: 'vault-api:all',
      }),
    });

    if (!response.ok) {
      console.error('[Security] VGS OAuth token request failed:', response.status);
      throw new Error('VGS authentication failed');
    }

    const tokenData = await response.json();

    // Cache the token
    tokenCache = {
      accessToken: tokenData.access_token,
      expiresAt: now + (tokenData.expires_in * 1000),
    };

    return tokenCache.accessToken;
  }

  /**
   * Get headers for VGS API requests
   * Uses OAuth Bearer token (preferred) or Basic Auth (legacy)
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const auth = this.config.auth;

    if (auth.type === 'oauth') {
      const token = await this.getOAuthToken();
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }

    // Legacy Basic auth - log deprecation warning
    if (auth.accessCredentials) {
      console.warn('[Security] VGS Basic auth is deprecated. Migrate to OAuth authentication.');
      return {
        'Authorization': `Basic ${auth.accessCredentials}`,
        'Content-Type': 'application/json',
      };
    }

    throw new Error('[Security] No valid VGS authentication configured');
  }

  /**
   * Tokenize card data
   * Called when receiving card data from VGS Collect JS
   */
  async tokenize(cardData: {
    number: string;
    expMonth: string;
    expYear: string;
    cvc: string;
    cardholderName?: string;
  }): Promise<VGSTokenizeResponse> {
    // VGS uses aliases - card data is already tokenized by VGS Collect
    // The "number" field contains the VGS alias, not the actual card number

    const headers = await this.getHeaders();

    // Redact sensitive data and get alias
    const response = await fetch(`${this.baseUrl}/post`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        card: {
          number: cardData.number,
          exp_month: cardData.expMonth,
          exp_year: cardData.expYear,
          cvc: cardData.cvc,
          name: cardData.cardholderName,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`VGS tokenization failed: ${response.status}`);
    }

    const result = await response.json();

    // Extract card metadata from the alias format
    // VGS aliases typically include the last4 in the alias itself
    const alias = result.card?.number || cardData.number;

    return {
      tokenId: alias,
      last4: this.extractLast4(alias),
      cardBrand: result.card?.brand,
      expMonth: parseInt(cardData.expMonth),
      expYear: parseInt(cardData.expYear),
    };
  }

  /**
   * Proxy a request to a PSP through VGS
   * VGS will replace aliases with actual card data
   */
  async proxyRequest(
    targetUrl: string,
    method: 'POST' | 'PUT' | 'PATCH',
    body: Record<string, unknown>,
    headers?: Record<string, string>
  ): Promise<Response> {
    // VGS inbound proxy - replace aliases with actual data
    const proxyUrl = `${this.baseUrl}/proxy`;
    const authHeaders = await this.getHeaders();

    const response = await fetch(proxyUrl, {
      method,
      headers: {
        ...authHeaders,
        ...headers,
        'X-VGS-Target-URL': targetUrl,
      },
      body: JSON.stringify(body),
    });

    return response;
  }

  /**
   * Reveal tokenized data (for authorized use only)
   */
  async reveal(alias: string): Promise<{ number: string; expMonth: string; expYear: string }> {
    const headers = await this.getHeaders();

    // VGS reveal endpoint
    const response = await fetch(`${this.baseUrl}/reveal`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ alias }),
    });

    if (!response.ok) {
      throw new Error(`VGS reveal failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Delete a token/alias
   */
  async deleteToken(alias: string): Promise<void> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}/aliases/${alias}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`VGS delete failed: ${response.status}`);
    }
  }

  /**
   * Extract last 4 digits from VGS alias
   * VGS aliases often embed metadata like last4
   */
  private extractLast4(alias: string): string | undefined {
    // VGS alias format varies, try to extract last4 if present
    // Example: tok_sandbox_abc123_1234 -> 1234
    const match = alias.match(/_(\d{4})$/);
    return match ? match[1] : undefined;
  }
}

/**
 * Create VGS vault instance with OAuth authentication (preferred)
 */
export function createVGSVault(config: VGSConfig): VGSVault {
  return new VGSVault(config);
}

/**
 * Legacy config format (deprecated)
 * @deprecated Use createVGSVault with OAuth config instead
 */
export interface LegacyVGSConfig {
  vaultId: string;
  environment: 'sandbox' | 'live';
  accessCredentials: string;
}

/**
 * Create VGS vault from legacy Basic Auth config
 * @deprecated Migrate to OAuth authentication
 */
export function createVGSVaultFromLegacy(legacyConfig: LegacyVGSConfig): VGSVault {
  console.warn('[Security] createVGSVaultFromLegacy is deprecated. Migrate to OAuth authentication.');
  return new VGSVault({
    vaultId: legacyConfig.vaultId,
    environment: legacyConfig.environment,
    auth: {
      type: 'basic',
      accessCredentials: legacyConfig.accessCredentials,
    },
  });
}

/**
 * Create VGS vault with OAuth authentication
 * This is the recommended way to create a VGS vault instance
 */
export function createVGSVaultWithOAuth(options: {
  vaultId: string;
  environment: 'sandbox' | 'live';
  clientId: string;
  clientSecret: string;
}): VGSVault {
  return new VGSVault({
    vaultId: options.vaultId,
    environment: options.environment,
    auth: {
      type: 'oauth',
      clientId: options.clientId,
      clientSecret: options.clientSecret,
    },
  });
}

/**
 * VGS Collect JS configuration for frontend
 */
export interface VGSCollectConfig {
  vaultId: string;
  environment: 'sandbox' | 'live';
  formId: string;
}

/**
 * Generate VGS Collect initialization script
 */
export function getVGSCollectScript(config: VGSCollectConfig): string {
  const env = config.environment === 'live' ? 'live' : 'sandbox';
  return `
    <script src="https://js.verygoodvault.com/vgs-collect/2.18.0/vgs-collect.js"></script>
    <script>
      const vgsForm = VGSCollect.create('${config.vaultId}', '${env}', function(state) {});

      vgsForm.field('#cc-number', {
        type: 'card-number',
        name: 'card_number',
        placeholder: '4111 1111 1111 1111',
        validations: ['required', 'validCardNumber'],
      });

      vgsForm.field('#cc-expiry', {
        type: 'card-expiration-date',
        name: 'card_expiry',
        placeholder: 'MM / YY',
        validations: ['required', 'validCardExpirationDate'],
      });

      vgsForm.field('#cc-cvc', {
        type: 'card-security-code',
        name: 'card_cvc',
        placeholder: 'CVC',
        validations: ['required', 'validCardSecurityCode'],
      });
    </script>
  `;
}
