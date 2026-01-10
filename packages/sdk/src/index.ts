import type {
  AtlasError,
  Payment,
  SessionConfig,
  PaymentMethodType,
} from '@atlas/shared';

// ============================================
// Atlas SDK v1.1
// PCI-Compliant Payment Orchestration Layer
// ============================================

// ---- Types ----

export interface AtlasConfig {
  apiKey: string;
  environment?: 'sandbox' | 'production';
  elementsUrl?: string;
}

export interface AtlasAppearance {
  theme?: 'default' | 'night' | 'minimal';
  variables?: {
    colorPrimary?: string;
    colorBackground?: string;
    colorText?: string;
    colorDanger?: string;
    colorSuccess?: string;
    fontFamily?: string;
    fontSizeBase?: string;
    borderRadius?: string;
    borderColor?: string;
    spacingUnit?: string;
  };
  rules?: {
    '.Input'?: Record<string, string>;
    '.Input:focus'?: Record<string, string>;
    '.Input--invalid'?: Record<string, string>;
    '.Label'?: Record<string, string>;
    '.Error'?: Record<string, string>;
  };
}

export interface AtlasChangeEvent {
  complete: boolean;
  empty: boolean;
  error?: {
    message: string;
    code: string;
    field?: string;
  };
  brand?: string;
  value?: {
    postalCode?: string;
  };
}

export interface AtlasMountOptions {
  elementId: string;
  sessionId: string;
  clientSecret: string;
  appearance?: AtlasAppearance;
  locale?: string;
  onReady?: () => void;
  onChange?: (event: AtlasChangeEvent) => void;
  onFocus?: (field: string) => void;
  onBlur?: (field: string) => void;
  onSuccess?: (payment: Payment) => void;
  onError?: (error: AtlasError) => void;
}

// ---- Constants ----

const DEFAULT_ELEMENTS_URLS = {
  sandbox: 'http://localhost:3001',
  production: 'https://elements.atlas.io', // Production URL
};

// ---- SDK Class ----

class AtlasSDK {
  private config: AtlasConfig | null = null;
  private mountOptions: AtlasMountOptions | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private mounted: boolean = false;
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  /**
   * Configure the Atlas SDK with your API key and environment
   */
  public configure(config: AtlasConfig): void {
    this.config = {
      environment: 'sandbox',
      ...config,
    };
  }

  /**
   * Mount the payment form into a container element
   */
  public async mount(options: AtlasMountOptions): Promise<void> {
    if (!this.config) {
      throw new Error('Atlas not configured. Call Atlas.configure() first.');
    }
    if (this.mounted) {
      console.warn('Atlas already mounted. Call unmount() first to remount.');
      return;
    }

    this.mountOptions = options;
    const container = document.getElementById(options.elementId);
    if (!container) {
      throw new Error(`Container element #${options.elementId} not found`);
    }

    // Build tokenizer URL
    const baseUrl = this.config.elementsUrl ||
      DEFAULT_ELEMENTS_URLS[this.config.environment || 'sandbox'];

    const params = new URLSearchParams({
      sessionId: options.sessionId,
      env: this.config.environment || 'sandbox',
      parentOrigin: window.location.origin,
    });

    // Pass appearance config
    if (options.appearance) {
      params.set('appearance', btoa(JSON.stringify(options.appearance)));
    }

    if (options.locale) {
      params.set('locale', options.locale);
    }

    // Create secure iframe
    this.iframe = document.createElement('iframe');
    this.iframe.src = `${baseUrl}?${params.toString()}`;
    this.iframe.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 320px;
      border: none;
      overflow: hidden;
      display: block;
    `;
    this.iframe.setAttribute('allowtransparency', 'true');
    this.iframe.setAttribute('frameborder', '0');
    this.iframe.setAttribute('scrolling', 'no');
    this.iframe.title = 'Secure payment input frame';

    container.appendChild(this.iframe);
    this.mounted = true;

    // Set up message handler with origin validation
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);
  }

  /**
   * Unmount the payment form and clean up
   */
  public unmount(): void {
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.mounted = false;
    this.iframe = null;
    this.mountOptions = null;
  }

  /**
   * Update the payment form state
   */
  public update(options: { disabled?: boolean; loading?: boolean }): void {
    if (!this.iframe || !this.iframe.contentWindow) {
      console.warn('Atlas not mounted');
      return;
    }

    const targetOrigin = this.getElementsOrigin();
    this.iframe.contentWindow.postMessage({
      type: 'ATLAS_UPDATE',
      payload: options,
    }, targetOrigin);
  }

  /**
   * Trigger payment confirmation (tokenize and process)
   */
  public async confirm(): Promise<void> {
    if (!this.iframe || !this.iframe.contentWindow) {
      throw new Error('Atlas not mounted. Call mount() first.');
    }

    const targetOrigin = this.getElementsOrigin();
    this.iframe.contentWindow.postMessage({ type: 'ATLAS_CONFIRM' }, targetOrigin);
  }

  /**
   * Clear the payment form
   */
  public clear(): void {
    if (!this.iframe || !this.iframe.contentWindow) {
      return;
    }

    const targetOrigin = this.getElementsOrigin();
    this.iframe.contentWindow.postMessage({ type: 'ATLAS_CLEAR' }, targetOrigin);
  }

  /**
   * Focus a specific field in the payment form
   */
  public focus(field: 'cardNumber' | 'expiry' | 'cvc' | 'cardHolder'): void {
    if (!this.iframe || !this.iframe.contentWindow) {
      return;
    }

    const targetOrigin = this.getElementsOrigin();
    this.iframe.contentWindow.postMessage({
      type: 'ATLAS_FOCUS',
      payload: { field },
    }, targetOrigin);
  }

  // ---- Private Methods ----

  private getElementsOrigin(): string {
    if (this.config?.elementsUrl) {
      return new URL(this.config.elementsUrl).origin;
    }
    return new URL(DEFAULT_ELEMENTS_URLS[this.config?.environment || 'sandbox']).origin;
  }

  private handleMessage(event: MessageEvent): void {
    // Security: Validate origin
    const expectedOrigin = this.getElementsOrigin();
    if (event.origin !== expectedOrigin) {
      // In development, also allow localhost variants
      if (this.config?.environment === 'sandbox') {
        const isLocalhost = event.origin.includes('localhost') || event.origin.includes('127.0.0.1');
        if (!isLocalhost) {
          return;
        }
      } else {
        return;
      }
    }

    const { type, payload } = event.data || {};
    if (!type) return;

    switch (type) {
      case 'ATLAS_READY':
        this.mountOptions?.onReady?.();
        break;

      case 'ATLAS_CHANGE':
        this.mountOptions?.onChange?.(payload as AtlasChangeEvent);
        break;

      case 'ATLAS_FOCUS':
        this.mountOptions?.onFocus?.(payload?.field);
        break;

      case 'ATLAS_BLUR':
        this.mountOptions?.onBlur?.(payload?.field);
        break;

      case 'ATLAS_TOKEN_CREATED':
        this.handleTokenCreated(payload.tokenId, payload.card);
        break;

      case 'ATLAS_ERROR':
        this.mountOptions?.onError?.(payload as AtlasError);
        break;

      case 'ATLAS_RESIZE':
        if (this.iframe && payload?.height) {
          this.iframe.style.height = `${payload.height}px`;
        }
        break;
    }
  }

  private async handleTokenCreated(
    tokenId: string,
    card: { brand: string; last4: string; expiryMonth: string; expiryYear: string }
  ): Promise<void> {
    try {
      const response = await fetch(`${globalConfig.apiBase}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.mountOptions?.clientSecret}`,
        },
        body: JSON.stringify({
          session_id: this.mountOptions?.sessionId,
          token_id: tokenId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Payment confirmation failed');
      }

      const payment = await response.json();
      this.mountOptions?.onSuccess?.(payment);
    } catch (err: any) {
      this.mountOptions?.onError?.({
        message: err.message || 'Payment failed',
        code: 'payment_failed',
      } as AtlasError);
    }
  }
}

// ---- Global Configuration ----

const globalConfig = {
  apiBase: typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : 'http://localhost:3000/api',
};

/**
 * Set the API base URL (for custom deployments)
 */
export function setApiBase(url: string): void {
  globalConfig.apiBase = url;
}

// ---- Exports ----

export const Atlas = new AtlasSDK();
export default Atlas;

// Re-export types for consumers
export type { Payment, AtlasError } from '@atlas/shared';
