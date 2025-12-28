// ============================================
// VGS (Very Good Security) Vault Adapter
// Alternative vault provider to Basis Theory
// ============================================

export interface VGSConfig {
  vaultId: string;
  environment: 'sandbox' | 'live';
  accessCredentials: string; // base64 encoded username:password
}

export interface VGSTokenizeResponse {
  tokenId: string;
  cardBrand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
}

/**
 * VGS Vault Adapter
 * Handles card tokenization and proxy requests through VGS
 */
export class VGSVault {
  private config: VGSConfig;
  private baseUrl: string;

  constructor(config: VGSConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'live'
      ? `https://${config.vaultId}.live.verygoodproxy.com`
      : `https://${config.vaultId}.sandbox.verygoodproxy.com`;
  }

  /**
   * Get headers for VGS API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Basic ${this.config.accessCredentials}`,
      'Content-Type': 'application/json',
    };
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

    // Redact sensitive data and get alias
    const response = await fetch(`${this.baseUrl}/post`, {
      method: 'POST',
      headers: this.getHeaders(),
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

    const response = await fetch(proxyUrl, {
      method,
      headers: {
        ...this.getHeaders(),
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
    // VGS reveal endpoint
    const response = await fetch(`${this.baseUrl}/reveal`, {
      method: 'POST',
      headers: this.getHeaders(),
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
    const response = await fetch(`${this.baseUrl}/aliases/${alias}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
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
 * Create VGS vault instance
 */
export function createVGSVault(config: VGSConfig): VGSVault {
  return new VGSVault(config);
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
