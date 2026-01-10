import type {
  AtlasConfig, // We can rename these later
  AtlasError,
  Payment,
  SessionConfig,
  PaymentMethodType,
} from '@atlas/shared';

// ============================================
// Atlas SDK v1.0
// PCI-Compliant Payment Orchestration Layer
// ============================================

export interface AtlasConfig {
  apiKey: string;
  environment?: 'sandbox' | 'production';
  tokenizerUrl?: string; // Allow override for dev
}

export interface AtlasMountOptions {
  elementId: string;
  sessionId: string;
  clientSecret: string;
  appearance?: any; // To be defined
  onReady?: () => void;
  onSuccess?: (payment: Payment) => void;
  onError?: (error: any) => void;
}

const DEFAULT_TOKENIZER_URL = 'http://localhost:3001/tokenizer'; // Local for now

class AtlasSDK {
  private config: AtlasConfig | null = null;
  private mountOptions: AtlasMountOptions | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private mounted: boolean = false;

  public configure(config: AtlasConfig) {
    this.config = config;
  }

  public async mount(options: AtlasMountOptions): Promise<void> {
    if (!this.config) {
      throw new Error('Atlas not configured. Call configure() first.');
    }
    if (this.mounted) {
      console.warn('Atlas already mounted.');
      return;
    }

    this.mountOptions = options;
    const container = document.getElementById(options.elementId);
    if (!container) {
      throw new Error(`Element #${options.elementId} not found`);
    }

    // Create the Secure Iframe
    this.iframe = document.createElement('iframe');
    const baseUrl = this.config.tokenizerUrl || DEFAULT_TOKENIZER_URL;
    
    // Pass session context to the iframe via query params or fragment
    // In a real world, we might use a one-time init token.
    // Here we pass the session ID securely.
    const parentOrigin = window.location.origin;
    this.iframe.src = `${baseUrl}?sessionId=${options.sessionId}&env=${this.config.environment || 'sandbox'}&parentOrigin=${parentOrigin}`;
    
    this.iframe.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 400px; /* Adjust based on content */
      border: none;
      overflow: hidden;
    `;

    container.appendChild(this.iframe);
    this.mounted = true;

    // Listen for messages from the iframe
    window.addEventListener('message', this.handleMessage.bind(this));

    // Wait for iframe ready
    // This would be handled by a specific 'READY' message from the iframe
  }

  public unmount() {
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    window.removeEventListener('message', this.handleMessage.bind(this));
    this.mounted = false;
    this.iframe = null;
  }

  public async confirm() {
    if (!this.iframe || !this.iframe.contentWindow) {
      throw new Error('Atlas iframe not loaded');
    }
    // Signal the iframe to tokenize and submit
    this.iframe.contentWindow.postMessage({ type: 'ATLAS_CONFIRM' }, '*');
  }

  private handleMessage(event: MessageEvent) {
    // Security check: Ensure origin matches tokenizer URL
    // const expectedOrigin = new URL(this.config?.tokenizerUrl || DEFAULT_TOKENIZER_URL).origin;
    // if (event.origin !== expectedOrigin) return; 

    const { type, payload } = event.data;

    switch (type) {
      case 'ATLAS_READY':
        this.mountOptions?.onReady?.();
        break;
      case 'ATLAS_TOKEN_CREATED':
        // The iframe has successfully tokenized the card
        // Payload contains the Token ID (not the PAN)
        this.handleTokenCreated(payload.tokenId);
        break;
      case 'ATLAS_ERROR':
        this.mountOptions?.onError?.(payload);
        break;
      case 'ATLAS_RESIZE':
         if (this.iframe) {
             this.iframe.style.height = `${payload.height}px`;
         }
         break;
    }
  }

  private async handleTokenCreated(tokenId: string) {
    // Now we confirm with our API
    try {
      const response = await fetch(`${globalConfig.apiBase}/confirm-payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.mountOptions?.clientSecret}`
        },
        body: JSON.stringify({
            session_id: this.mountOptions?.sessionId,
            token_id: tokenId
        })
      });

      if (!response.ok) throw new Error('Payment confirmation failed');
      
      const payment = await response.json();
      this.mountOptions?.onSuccess?.(payment);

    } catch (err) {
      this.mountOptions?.onError?.(err);
    }
  }
}

// Global Config (Placeholder until we have a proper config loader)
const globalConfig = {
    apiBase: 'http://localhost:3000/api' // Dev default
};

export const Atlas = new AtlasSDK();
export default Atlas;