import type {
  AtlasError,
  Payment,
  SessionConfig,
  PaymentMethodType,
} from '@atlas/shared';

// ============================================
// Atlas SDK v2.0
// PCI-Compliant Payment Orchestration Layer
// ============================================

// ---- Types ----

export interface AtlasConfig {
  /**
   * Your publishable API key (pk_test_xxx or pk_live_xxx)
   * Used to identify your account in client-side requests
   */
  publishableKey: string;

  /**
   * Environment: 'sandbox' for testing, 'production' for live payments
   * @default 'sandbox'
   */
  environment?: 'sandbox' | 'production';

  /**
   * Custom API URL (for self-hosted/on-prem deployments)
   * @default Based on environment
   */
  apiUrl?: string;

  /**
   * Custom Elements URL (for self-hosted/on-prem deployments)
   * @default Based on environment
   */
  elementsUrl?: string;

  /**
   * Locale for UI strings
   * @default 'en'
   */
  locale?: string;
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
  /**
   * DOM element ID to mount the payment form into
   */
  elementId: string;

  /**
   * Client secret from the payment session (cs_xxx)
   * This authenticates the session and determines what can be done
   */
  clientSecret: string;

  /**
   * Appearance customization
   */
  appearance?: AtlasAppearance;

  /**
   * Layout style: 'tabs' for tabbed interface, 'accordion' for expandable sections
   * @default 'tabs'
   */
  layout?: 'tabs' | 'accordion';

  /**
   * Payment methods to display. If not specified, uses session configuration.
   */
  paymentMethodTypes?: PaymentMethodType[];

  /**
   * Called when the form is ready to accept input
   */
  onReady?: () => void;

  /**
   * Called when form validation state changes
   */
  onChange?: (event: AtlasChangeEvent) => void;

  /**
   * Called when a field gains focus
   */
  onFocus?: (field: string) => void;

  /**
   * Called when a field loses focus
   */
  onBlur?: (field: string) => void;

  /**
   * Called when payment succeeds
   */
  onSuccess?: (payment: Payment) => void;

  /**
   * Called when an error occurs
   */
  onError?: (error: AtlasError) => void;
}

// ---- Hosted Fields Types ----

export type ElementType = 'cardNumber' | 'cardExpiry' | 'cardCvc' | 'cardHolder';

export interface ElementOptions {
  /**
   * Appearance customization for this element
   */
  appearance?: AtlasAppearance;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Whether the field is disabled
   */
  disabled?: boolean;

  /**
   * Show card brand icon (cardNumber only)
   */
  showIcon?: boolean;

  /**
   * Icon position (cardNumber only)
   * @default 'right'
   */
  iconPosition?: 'left' | 'right';
}

export interface ElementInstance {
  /**
   * Mount the element to a DOM element
   */
  mount: (elementId: string) => void;

  /**
   * Unmount and destroy the element
   */
  unmount: () => void;

  /**
   * Focus the element
   */
  focus: () => void;

  /**
   * Blur the element
   */
  blur: () => void;

  /**
   * Clear the element value
   */
  clear: () => void;

  /**
   * Update element options
   */
  update: (options: Partial<ElementOptions>) => void;

  /**
   * Subscribe to element events
   */
  on: (event: 'ready' | 'change' | 'focus' | 'blur' | 'error', handler: (data?: any) => void) => void;

  /**
   * Unsubscribe from element events
   */
  off: (event: 'ready' | 'change' | 'focus' | 'blur' | 'error', handler?: (data?: any) => void) => void;
}

export interface ElementsInstance {
  /**
   * Create a hosted field element
   */
  create: (type: ElementType, options?: ElementOptions) => ElementInstance;

  /**
   * Get all created elements
   */
  getElement: (type: ElementType) => ElementInstance | null;

  /**
   * Tokenize all mounted card elements
   */
  createToken: () => Promise<{ tokenId: string; card: { brand: string; last4: string; expiryMonth: string; expiryYear: string } }>;

  /**
   * Confirm the payment using the tokenized card data
   */
  confirmPayment: (options?: ConfirmOptions) => Promise<Payment>;
}

export interface ConfirmOptions {
  /**
   * URL to redirect to after payment completes (for 3DS flows)
   */
  returnUrl?: string;

  /**
   * Additional data to pass with the payment
   */
  paymentMethodData?: {
    billingDetails?: {
      name?: string;
      email?: string;
      phone?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    };
  };
}

// ---- Constants ----

const DEFAULT_API_URLS = {
  sandbox: 'https://api.atlas.io/v1',
  production: 'https://api.atlas.io/v1',
};

const DEFAULT_ELEMENTS_URLS = {
  sandbox: 'https://elements.atlas.io',
  production: 'https://elements.atlas.io',
};

// Dev overrides (only in non-production builds)
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
  DEFAULT_API_URLS.sandbox = 'http://localhost:54321/functions/v1';
  DEFAULT_ELEMENTS_URLS.sandbox = 'http://localhost:3001';
}

// ---- Element Class ----

class AtlasElement implements ElementInstance {
  private type: ElementType;
  private options: ElementOptions;
  private iframe: HTMLIFrameElement | null = null;
  private containerId: string | null = null;
  private isMounted: boolean = false;
  private eventHandlers: Map<string, Set<(data?: any) => void>> = new Map();
  private elementsUrl: string;
  private publishableKey: string;
  private clientSecret: string;
  private parentOrigin: string;

  constructor(
    type: ElementType,
    options: ElementOptions,
    elementsUrl: string,
    publishableKey: string,
    clientSecret: string
  ) {
    this.type = type;
    this.options = options;
    this.elementsUrl = elementsUrl;
    this.publishableKey = publishableKey;
    this.clientSecret = clientSecret;
    this.parentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  }

  mount(elementId: string): void {
    if (this.isMounted) {
      console.warn(`Atlas: Element ${this.type} is already mounted`);
      return;
    }

    const container = document.getElementById(elementId);
    if (!container) {
      throw new Error(`Atlas: Container element #${elementId} not found`);
    }

    this.containerId = elementId;

    // Build element iframe URL
    const params = new URLSearchParams({
      type: this.type,
      clientSecret: this.clientSecret,
      publishableKey: this.publishableKey,
      parentOrigin: this.parentOrigin,
      mode: 'element', // Indicates individual element mode vs drop-in
    });

    if (this.options.placeholder) {
      params.set('placeholder', this.options.placeholder);
    }
    if (this.options.disabled) {
      params.set('disabled', 'true');
    }
    if (this.options.showIcon !== undefined) {
      params.set('showIcon', String(this.options.showIcon));
    }
    if (this.options.iconPosition) {
      params.set('iconPosition', this.options.iconPosition);
    }
    if (this.options.appearance) {
      params.set('appearance', btoa(JSON.stringify(this.options.appearance)));
    }

    // Create iframe
    this.iframe = document.createElement('iframe');
    this.iframe.src = `${this.elementsUrl}/element?${params.toString()}`;
    this.iframe.style.cssText = `
      width: 100%;
      height: 44px;
      border: none;
      overflow: hidden;
      display: block;
    `;
    this.iframe.setAttribute('allowtransparency', 'true');
    this.iframe.setAttribute('frameborder', '0');
    this.iframe.setAttribute('scrolling', 'no');
    this.iframe.setAttribute('title', `Atlas ${this.type} field`);
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin');

    container.innerHTML = '';
    container.appendChild(this.iframe);
    this.isMounted = true;

    // Set up message handler
    window.addEventListener('message', this.handleMessage);
  }

  unmount(): void {
    if (this.iframe?.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    window.removeEventListener('message', this.handleMessage);
    this.iframe = null;
    this.isMounted = false;
    this.containerId = null;
  }

  focus(): void {
    this.sendMessage('ATLAS_ELEMENT_FOCUS');
  }

  blur(): void {
    this.sendMessage('ATLAS_ELEMENT_BLUR');
  }

  clear(): void {
    this.sendMessage('ATLAS_ELEMENT_CLEAR');
  }

  update(options: Partial<ElementOptions>): void {
    this.options = { ...this.options, ...options };
    this.sendMessage('ATLAS_ELEMENT_UPDATE', options);
  }

  on(event: 'ready' | 'change' | 'focus' | 'blur' | 'error', handler: (data?: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: 'ready' | 'change' | 'focus' | 'blur' | 'error', handler?: (data?: any) => void): void {
    if (!handler) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.get(event)?.delete(handler);
    }
  }

  // Internal methods
  getIframe(): HTMLIFrameElement | null {
    return this.iframe;
  }

  getType(): ElementType {
    return this.type;
  }

  private sendMessage(type: string, payload?: any): void {
    if (!this.iframe?.contentWindow) return;
    const origin = new URL(this.elementsUrl).origin;
    this.iframe.contentWindow.postMessage({ type, payload }, origin);
  }

  private handleMessage = (event: MessageEvent): void => {
    const expectedOrigin = new URL(this.elementsUrl).origin;
    if (event.origin !== expectedOrigin) return;

    const { type, payload, elementType } = event.data || {};
    if (elementType !== this.type) return;

    switch (type) {
      case 'ATLAS_ELEMENT_READY':
        this.emit('ready');
        break;
      case 'ATLAS_ELEMENT_CHANGE':
        this.emit('change', payload);
        break;
      case 'ATLAS_ELEMENT_FOCUS':
        this.emit('focus');
        break;
      case 'ATLAS_ELEMENT_BLUR':
        this.emit('blur');
        break;
      case 'ATLAS_ELEMENT_ERROR':
        this.emit('error', payload);
        break;
    }
  };

  private emit(event: string, data?: any): void {
    this.eventHandlers.get(event)?.forEach(handler => handler(data));
  }
}

// ---- Elements Instance Class ----

class AtlasElements implements ElementsInstance {
  private elements: Map<ElementType, AtlasElement> = new Map();
  private elementsUrl: string;
  private apiUrl: string;
  private publishableKey: string;
  private clientSecret: string;
  private sessionId: string;

  constructor(
    elementsUrl: string,
    apiUrl: string,
    publishableKey: string,
    clientSecret: string,
    sessionId: string
  ) {
    this.elementsUrl = elementsUrl;
    this.apiUrl = apiUrl;
    this.publishableKey = publishableKey;
    this.clientSecret = clientSecret;
    this.sessionId = sessionId;
  }

  create(type: ElementType, options: ElementOptions = {}): ElementInstance {
    if (this.elements.has(type)) {
      console.warn(`Atlas: Element ${type} already exists. Returning existing instance.`);
      return this.elements.get(type)!;
    }

    const element = new AtlasElement(
      type,
      options,
      this.elementsUrl,
      this.publishableKey,
      this.clientSecret
    );
    this.elements.set(type, element);
    return element;
  }

  getElement(type: ElementType): ElementInstance | null {
    return this.elements.get(type) || null;
  }

  async createToken(): Promise<{ tokenId: string; card: { brand: string; last4: string; expiryMonth: string; expiryYear: string } }> {
    // Request token from cardNumber element (it coordinates with other elements)
    const cardNumberElement = this.elements.get('cardNumber');
    if (!cardNumberElement) {
      throw new Error('Atlas: cardNumber element is required for tokenization');
    }

    return new Promise((resolve, reject) => {
      const handleToken = (event: MessageEvent) => {
        const expectedOrigin = new URL(this.elementsUrl).origin;
        if (event.origin !== expectedOrigin) return;

        const { type, payload } = event.data || {};
        if (type === 'ATLAS_TOKEN_CREATED') {
          window.removeEventListener('message', handleToken);
          resolve(payload);
        } else if (type === 'ATLAS_TOKEN_ERROR') {
          window.removeEventListener('message', handleToken);
          reject(payload);
        }
      };

      window.addEventListener('message', handleToken);

      // Send tokenize request to all elements
      this.elements.forEach(element => {
        const iframe = element.getIframe();
        if (iframe?.contentWindow) {
          const origin = new URL(this.elementsUrl).origin;
          iframe.contentWindow.postMessage({ type: 'ATLAS_TOKENIZE' }, origin);
        }
      });
    });
  }

  async confirmPayment(options?: ConfirmOptions): Promise<Payment> {
    // First tokenize
    const tokenResult = await this.createToken();

    // Then confirm payment
    const response = await fetch(`${this.apiUrl}/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.clientSecret}`,
        'X-Atlas-Publishable-Key': this.publishableKey,
      },
      body: JSON.stringify({
        session_id: this.sessionId,
        token_id: tokenResult.tokenId,
        ...options?.paymentMethodData,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw {
        message: data.error?.message || data.message || 'Payment failed',
        code: data.error?.code || 'payment_failed',
        declineCode: data.error?.decline_code,
      };
    }

    return data as Payment;
  }
}

// ---- SDK Class ----

class AtlasSDK {
  private config: AtlasConfig | null = null;
  private mountOptions: AtlasMountOptions | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private mounted: boolean = false;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private sessionId: string | null = null;

  /**
   * Initialize the Atlas SDK
   *
   * @example
   * ```typescript
   * Atlas.init({
   *   publishableKey: 'pk_test_xxx',
   *   environment: 'sandbox',
   * });
   * ```
   */
  public init(config: AtlasConfig): void {
    if (!config.publishableKey) {
      throw new Error('Atlas: publishableKey is required');
    }

    this.config = {
      environment: 'sandbox',
      locale: 'en',
      ...config,
    };
  }

  /**
   * @deprecated Use init() instead
   */
  public configure(config: AtlasConfig): void {
    console.warn('Atlas.configure() is deprecated. Use Atlas.init() instead.');
    this.init(config);
  }

  /**
   * Mount the payment form (Drop-in component)
   *
   * @example
   * ```typescript
   * Atlas.mount({
   *   elementId: 'payment-element',
   *   clientSecret: 'cs_xxx',
   *   onSuccess: (payment) => console.log('Paid!', payment),
   *   onError: (error) => console.error('Error:', error),
   * });
   * ```
   */
  public async mount(options: AtlasMountOptions): Promise<void> {
    if (!this.config) {
      throw new Error('Atlas: Not initialized. Call Atlas.init() first.');
    }

    if (!options.clientSecret) {
      throw new Error('Atlas: clientSecret is required');
    }

    if (this.mounted) {
      console.warn('Atlas: Already mounted. Call unmount() first to remount.');
      return;
    }

    // Extract session ID from client secret (format: cs_sessionId_random)
    const secretParts = options.clientSecret.split('_');
    if (secretParts.length < 2) {
      throw new Error('Atlas: Invalid clientSecret format');
    }
    this.sessionId = await this.getSessionIdFromSecret(options.clientSecret);

    this.mountOptions = options;
    const container = document.getElementById(options.elementId);
    if (!container) {
      throw new Error(`Atlas: Container element #${options.elementId} not found`);
    }

    // Build Elements iframe URL
    const elementsUrl = this.getElementsUrl();
    const params = new URLSearchParams({
      clientSecret: options.clientSecret,
      publishableKey: this.config.publishableKey,
      env: this.config.environment || 'sandbox',
      parentOrigin: window.location.origin,
      locale: this.config.locale || 'en',
      layout: options.layout || 'tabs',
    });

    // Pass appearance config (base64 encoded to handle special chars)
    if (options.appearance) {
      params.set('appearance', btoa(JSON.stringify(options.appearance)));
    }

    if (options.paymentMethodTypes) {
      params.set('paymentMethods', options.paymentMethodTypes.join(','));
    }

    // Create secure iframe
    this.iframe = document.createElement('iframe');
    this.iframe.src = `${elementsUrl}?${params.toString()}`;
    this.iframe.style.cssText = `
      width: 100%;
      min-height: 300px;
      border: none;
      overflow: hidden;
      display: block;
      transition: height 0.2s ease;
    `;
    this.iframe.setAttribute('allowtransparency', 'true');
    this.iframe.setAttribute('frameborder', '0');
    this.iframe.setAttribute('scrolling', 'no');
    this.iframe.setAttribute('title', 'Atlas secure payment form');
    // Security: sandbox with specific permissions
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups');

    container.innerHTML = ''; // Clear container
    container.appendChild(this.iframe);
    this.mounted = true;

    // Set up message handler with origin validation
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);
  }

  /**
   * Unmount the payment form and clean up resources
   */
  public unmount(): void {
    if (this.iframe?.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.mounted = false;
    this.iframe = null;
    this.mountOptions = null;
    this.sessionId = null;
  }

  /**
   * Confirm the payment (triggers tokenization and processing)
   * Usually called automatically when user submits, but can be called manually.
   */
  public async confirm(options?: ConfirmOptions): Promise<Payment> {
    if (!this.iframe?.contentWindow) {
      throw new Error('Atlas: Not mounted. Call mount() first.');
    }

    return new Promise((resolve, reject) => {
      // Store resolve/reject for use in message handler
      const originalOnSuccess = this.mountOptions?.onSuccess;
      const originalOnError = this.mountOptions?.onError;

      if (this.mountOptions) {
        this.mountOptions.onSuccess = (payment) => {
          originalOnSuccess?.(payment);
          resolve(payment);
        };
        this.mountOptions.onError = (error) => {
          originalOnError?.(error);
          reject(error);
        };
      }

      // Send confirm message to iframe
      const targetOrigin = this.getElementsOrigin();
      this.iframe!.contentWindow!.postMessage({
        type: 'ATLAS_CONFIRM',
        payload: options || {},
      }, targetOrigin);
    });
  }

  /**
   * Update form state (e.g., show loading state)
   */
  public update(options: { disabled?: boolean; loading?: boolean }): void {
    if (!this.iframe?.contentWindow) {
      console.warn('Atlas: Not mounted');
      return;
    }

    const targetOrigin = this.getElementsOrigin();
    this.iframe.contentWindow.postMessage({
      type: 'ATLAS_UPDATE',
      payload: options,
    }, targetOrigin);
  }

  /**
   * Clear all form fields
   */
  public clear(): void {
    if (!this.iframe?.contentWindow) return;

    const targetOrigin = this.getElementsOrigin();
    this.iframe.contentWindow.postMessage({ type: 'ATLAS_CLEAR' }, targetOrigin);
  }

  /**
   * Focus a specific field
   */
  public focus(field: 'cardNumber' | 'expiry' | 'cvc' | 'cardHolder'): void {
    if (!this.iframe?.contentWindow) return;

    const targetOrigin = this.getElementsOrigin();
    this.iframe.contentWindow.postMessage({
      type: 'ATLAS_FOCUS',
      payload: { field },
    }, targetOrigin);
  }

  /**
   * Create an Elements instance for Hosted Fields integration
   * This allows mounting individual card input fields for custom payment forms.
   *
   * @example
   * ```typescript
   * // Create elements instance
   * const elements = await Atlas.elements({ clientSecret: 'cs_xxx' });
   *
   * // Create individual elements
   * const cardNumber = elements.create('cardNumber', { placeholder: 'Card number' });
   * const cardExpiry = elements.create('cardExpiry');
   * const cardCvc = elements.create('cardCvc');
   *
   * // Mount to DOM
   * cardNumber.mount('#card-number');
   * cardExpiry.mount('#card-expiry');
   * cardCvc.mount('#card-cvc');
   *
   * // Handle events
   * cardNumber.on('change', (event) => {
   *   if (event.complete) console.log('Card number complete');
   *   if (event.error) console.error(event.error.message);
   * });
   *
   * // Submit payment
   * const payment = await elements.confirmPayment();
   * ```
   */
  public async elements(options: { clientSecret: string }): Promise<ElementsInstance> {
    if (!this.config) {
      throw new Error('Atlas: Not initialized. Call Atlas.init() first.');
    }

    if (!options.clientSecret) {
      throw new Error('Atlas: clientSecret is required');
    }

    // Get session ID from client secret
    const sessionId = await this.getSessionIdFromSecret(options.clientSecret);

    return new AtlasElements(
      this.getElementsUrl(),
      this.getApiUrl(),
      this.config.publishableKey,
      options.clientSecret,
      sessionId
    );
  }

  // ---- Getters ----

  /**
   * Check if a payment form is currently mounted
   */
  public get isMounted(): boolean {
    return this.mounted;
  }

  /**
   * Get current environment
   */
  public get environment(): 'sandbox' | 'production' {
    return this.config?.environment || 'sandbox';
  }

  // ---- Private Methods ----

  private getApiUrl(): string {
    if (this.config?.apiUrl) {
      return this.config.apiUrl;
    }
    return DEFAULT_API_URLS[this.config?.environment || 'sandbox'];
  }

  private getElementsUrl(): string {
    if (this.config?.elementsUrl) {
      return this.config.elementsUrl;
    }
    return DEFAULT_ELEMENTS_URLS[this.config?.environment || 'sandbox'];
  }

  private getElementsOrigin(): string {
    return new URL(this.getElementsUrl()).origin;
  }

  private async getSessionIdFromSecret(clientSecret: string): Promise<string> {
    // Client secret format: cs_<random>
    // We need to call the API to get the session ID, or it should be passed separately
    // For now, extract from the response when we created the session
    // The session ID should be passed in mount options or retrieved from API

    // Call API to validate client secret and get session details
    try {
      const response = await fetch(`${this.getApiUrl()}/get-session-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clientSecret}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid client secret');
      }

      const data = await response.json();
      return data.session_id;
    } catch {
      // Fallback: assume session ID is embedded in secret (for backwards compat)
      return clientSecret;
    }
  }

  private handleMessage(event: MessageEvent): void {
    // Security: Validate origin
    const expectedOrigin = this.getElementsOrigin();
    const isValidOrigin = event.origin === expectedOrigin ||
      (this.config?.environment === 'sandbox' && this.isLocalhostOrigin(event.origin));

    if (!isValidOrigin) {
      return;
    }

    const { type, payload } = event.data || {};
    if (!type?.startsWith('ATLAS_')) return;

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
        this.handleTokenCreated(payload);
        break;

      case 'ATLAS_PAYMENT_SUCCESS':
        this.mountOptions?.onSuccess?.(payload as Payment);
        break;

      case 'ATLAS_ERROR':
        this.mountOptions?.onError?.(payload as AtlasError);
        break;

      case 'ATLAS_RESIZE':
        if (this.iframe && payload?.height) {
          this.iframe.style.height = `${Math.max(300, payload.height)}px`;
        }
        break;

      case 'ATLAS_3DS_REDIRECT':
        // Handle 3DS redirect
        if (payload?.url) {
          window.location.href = payload.url;
        }
        break;
    }
  }

  private isLocalhostOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }

  private async handleTokenCreated(payload: {
    tokenId: string;
    card: { brand: string; last4: string; expiryMonth: string; expiryYear: string };
  }): Promise<void> {
    try {
      // Call Atlas API to confirm the payment (NOT merchant's server)
      const response = await fetch(`${this.getApiUrl()}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.mountOptions?.clientSecret}`,
          'X-Atlas-Publishable-Key': this.config?.publishableKey || '',
        },
        body: JSON.stringify({
          session_id: this.sessionId,
          token_id: payload.tokenId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          message: data.error?.message || data.message || 'Payment failed',
          code: data.error?.code || 'payment_failed',
          declineCode: data.error?.decline_code,
        };
      }

      // Check if 3DS is required
      if (data.status === 'requires_action' && data.next_action?.type === 'redirect_to_url') {
        // Notify iframe to show 3DS challenge or redirect
        this.iframe?.contentWindow?.postMessage({
          type: 'ATLAS_3DS_REQUIRED',
          payload: data.next_action,
        }, this.getElementsOrigin());
        return;
      }

      // Payment succeeded
      this.mountOptions?.onSuccess?.(data as Payment);
    } catch (err: any) {
      this.mountOptions?.onError?.({
        message: err.message || 'Payment failed',
        code: err.code || 'payment_failed',
        declineCode: err.declineCode,
      } as AtlasError);
    }
  }
}

// ---- Singleton Export ----

export const Atlas = new AtlasSDK();
export default Atlas;

// ---- Type Re-exports ----

export type { Payment, AtlasError, PaymentMethodType } from '@atlas/shared';

// Re-export Hosted Fields types
export type {
  ElementType,
  ElementOptions,
  ElementInstance,
  ElementsInstance,
};
