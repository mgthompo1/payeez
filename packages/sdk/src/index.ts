import type {
  PayeezConfig,
  PayeezError,
  Payment,
  SessionConfig,
  PaymentMethodType,
} from '@payeez/shared';

// ============================================
// Payeez SDK v2.0
// Enterprise-grade payment orchestration with:
// - Multi-region failover
// - Circuit breaker pattern
// - Multi-vault tokenization (Basis Theory + VGS)
// - 3D Secure authentication
// - Network Token support
// ============================================

// ============================================
// Types and Interfaces
// ============================================

/**
 * Resilience configuration for enterprise deployments
 * Enables automatic failover when primary services are unavailable
 */
export interface ResilienceConfig {
  /** Ordered list of endpoints to try on failure */
  endpoints?: FailoverEndpoint[];

  /** Circuit breaker configuration */
  circuitBreaker?: {
    /** Number of failures before opening circuit */
    failureThreshold?: number;
    /** Time in ms before attempting recovery */
    recoveryTimeoutMs?: number;
    /** Health check interval in ms */
    healthCheckIntervalMs?: number;
  };

  /** Emergency direct PSP fallback when all else fails */
  emergency?: {
    enabled?: boolean;
    psp?: 'stripe' | 'adyen' | 'braintree';
  };

  /** Multi-vault tokenization for redundancy */
  vaults?: {
    primary?: 'basis_theory' | 'vgs';
    fallback?: 'basis_theory' | 'vgs';
    dualWrite?: boolean;
  };
}

export interface FailoverEndpoint {
  name: string;
  type: 'payeez' | 'basis_theory_reactor' | 'direct_psp';
  url?: string;
  region?: string;
}

/**
 * 3D Secure configuration
 */
export interface ThreeDSConfig {
  /** Preferred challenge mode */
  challengePreference?: 'no_preference' | 'no_challenge' | 'challenge_requested' | 'challenge_mandated';
  /** Container element ID for challenge iframe */
  challengeContainerId?: string;
  /** Callback when 3DS is required */
  onChallengeRequired?: () => void;
  /** Callback when 3DS challenge is complete */
  onChallengeComplete?: (result: ThreeDSResult) => void;
}

export interface ThreeDSResult {
  status: 'authenticated' | 'failed' | 'attempted' | 'unavailable';
  authenticationValue?: string;
  eci?: string;
  dsTransactionId?: string;
  liabilityShift: boolean;
}

/**
 * Network token configuration
 */
export interface NetworkTokenConfig {
  /** Enable network token creation for stored cards */
  enabled?: boolean;
  /** Request cryptogram for customer-initiated transactions */
  requestCryptogram?: boolean;
}

// Extended config with new features
interface PayeezMountConfig extends PayeezConfig {
  paymentMethods?: PaymentMethodType[];
  applePayButtonOptions?: {
    type?: 'plain' | 'buy' | 'donate' | 'checkout' | 'book' | 'subscribe';
    color?: 'black' | 'white' | 'white-outline';
  };
  googlePayButtonOptions?: {
    color?: 'default' | 'black' | 'white';
    type?: 'book' | 'buy' | 'checkout' | 'donate' | 'order' | 'pay' | 'plain' | 'subscribe';
  };
  /** Resilience configuration for enterprise deployments */
  resilience?: ResilienceConfig;
  /** 3D Secure configuration */
  threeds?: ThreeDSConfig;
  /** Network token configuration */
  networkTokens?: NetworkTokenConfig;
}

type VaultProvider = 'basis_theory' | 'vgs';
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface PayeezState {
  config: PayeezMountConfig | null;
  sessionConfig: SessionConfig | null;
  vaultProvider: VaultProvider;
  basisTheory: any | null;
  vgsCollect: any | null;
  cardElement: any | null;
  bankElement: any | null;
  applePaySession: any | null;
  googlePayClient: any | null;
  mounted: boolean;
  activeMethod: PaymentMethodType | null;
  // Resilience state
  circuitBreaker: CircuitBreakerState;
  healthStatus: Map<string, ServiceHealth>;
  pendingSyncTransactions: FallbackTransaction[];
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  successCount: number;
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  lastCheckAt: Date;
}

interface FallbackTransaction {
  id: string;
  session_id: string;
  route: string;
  data: any;
  timestamp: Date;
}

// ============================================
// Global Configuration
// ============================================

let globalConfig = {
  apiBase: 'https://api.payeez.co/functions/v1',
  // Default resilience settings
  resilience: {
    endpoints: [
      { name: 'primary', type: 'payeez' as const, url: 'https://api.payeez.co/functions/v1', region: 'us' },
      { name: 'backup', type: 'payeez' as const, url: 'https://eu.api.payeez.co/functions/v1', region: 'eu' },
      { name: 'reactor', type: 'basis_theory_reactor' as const, url: 'https://api.basistheory.com/reactors' },
    ],
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeoutMs: 30000,
      healthCheckIntervalMs: 10000,
    },
    emergency: {
      enabled: true,
      psp: 'stripe' as 'stripe' | 'adyen' | 'braintree',
    },
    vaults: {
      primary: 'basis_theory' as VaultProvider,
      fallback: 'vgs' as VaultProvider,
      dualWrite: false,
    },
  },
};

const state: PayeezState = {
  config: null,
  sessionConfig: null,
  vaultProvider: 'basis_theory',
  basisTheory: null,
  vgsCollect: null,
  cardElement: null,
  bankElement: null,
  applePaySession: null,
  googlePayClient: null,
  mounted: false,
  activeMethod: null,
  circuitBreaker: {
    state: 'CLOSED',
    failures: 0,
    lastFailureTime: 0,
    successCount: 0,
  },
  healthStatus: new Map(),
  pendingSyncTransactions: [],
};

// Health check interval handle
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

// ============================================
// Public API
// ============================================

/**
 * Configure the Payeez SDK globally
 *
 * @example
 * ```typescript
 * Payeez.configure({
 *   apiBase: 'https://api.payeez.co',
 *   resilience: {
 *     endpoints: [
 *       { name: 'primary', type: 'payeez', url: 'https://api.payeez.co' },
 *       { name: 'backup', type: 'payeez', url: 'https://eu.api.payeez.co' },
 *     ],
 *     circuitBreaker: {
 *       failureThreshold: 3,
 *       recoveryTimeoutMs: 30000,
 *     },
 *   },
 * });
 * ```
 */
export function configure(options: {
  apiBase?: string;
  resilience?: ResilienceConfig;
}): void {
  if (options.apiBase) {
    globalConfig.apiBase = options.apiBase.replace(/\/$/, '');
  }
  if (options.resilience) {
    // Merge resilience config with explicit typing
    if (options.resilience.endpoints) {
      globalConfig.resilience.endpoints = options.resilience.endpoints as typeof globalConfig.resilience.endpoints;
    }
    if (options.resilience.circuitBreaker) {
      globalConfig.resilience.circuitBreaker = {
        ...globalConfig.resilience.circuitBreaker,
        ...options.resilience.circuitBreaker,
      };
    }
    if (options.resilience.emergency) {
      globalConfig.resilience.emergency = {
        ...globalConfig.resilience.emergency,
        ...options.resilience.emergency,
      };
    }
    if (options.resilience.vaults) {
      globalConfig.resilience.vaults = {
        ...globalConfig.resilience.vaults,
        ...options.resilience.vaults,
      };
    }
  }
}

/**
 * Mount the Payeez payment form
 * Renders payment method tabs based on session config
 *
 * @example
 * ```typescript
 * await Payeez.mount({
 *   elementId: 'payment-container',
 *   sessionId: 'sess_xxx',
 *   clientSecret: 'secret_xxx',
 *   threeds: {
 *     challengeContainerId: '3ds-challenge',
 *     onChallengeRequired: () => console.log('Challenge required'),
 *   },
 *   onSuccess: (payment) => console.log('Payment successful', payment),
 *   onError: (error) => console.error('Payment failed', error),
 * });
 * ```
 */
export async function mount(config: PayeezMountConfig): Promise<void> {
  if (state.mounted) {
    console.warn('[Payeez] Already mounted. Call unmount() first.');
    return;
  }

  state.config = config;

  const container = document.getElementById(config.elementId);
  if (!container) {
    throw createError('ELEMENT_NOT_FOUND', `Element #${config.elementId} not found`);
  }

  try {
    // Start health monitoring
    startHealthMonitoring();

    // 1. Fetch session config with resilient fetch
    state.sessionConfig = await resilientFetch<SessionConfig>(
      `/get-session-config/${config.sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${config.clientSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // 2. Determine vault provider and initialize
    state.vaultProvider = (state.sessionConfig.capture_provider as VaultProvider) || 'basis_theory';

    // Initialize vault(s) based on config
    await initializeVaults(config);

    // 3. Render payment method UI
    await renderPaymentMethods(container, config);

    state.mounted = true;
    config.onReady?.();
  } catch (err) {
    const error = normalizeError(err);
    config.onError?.(error);

    if (state.sessionConfig?.fallback_url) {
      console.warn('[Payeez] Falling back to hosted checkout');
      window.location.href = state.sessionConfig.fallback_url;
    }

    throw error;
  }
}

/**
 * Unmount the payment form and clean up
 */
export function unmount(): void {
  // Stop health monitoring
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  if (state.cardElement) {
    if (state.vaultProvider === 'basis_theory') {
      state.cardElement.unmount();
    }
    state.cardElement = null;
  }
  if (state.bankElement) {
    if (state.vaultProvider === 'basis_theory') {
      state.bankElement.unmount();
    }
    state.bankElement = null;
  }

  state.config = null;
  state.sessionConfig = null;
  state.basisTheory = null;
  state.vgsCollect = null;
  state.applePaySession = null;
  state.googlePayClient = null;
  state.mounted = false;
  state.activeMethod = null;
  state.vaultProvider = 'basis_theory';
  state.circuitBreaker = {
    state: 'CLOSED',
    failures: 0,
    lastFailureTime: 0,
    successCount: 0,
  };
}

/**
 * Manually confirm the payment
 *
 * @param method - Optional payment method to use
 * @param options - Additional confirmation options
 */
export async function confirm(
  method?: PaymentMethodType,
  options?: {
    threeds?: ThreeDSConfig;
    networkToken?: boolean;
  }
): Promise<Payment> {
  if (!state.sessionConfig) {
    throw createError('NOT_MOUNTED', 'Payment form not mounted');
  }

  const paymentMethod = method || state.activeMethod || 'card';

  switch (paymentMethod) {
    case 'card':
      return await confirmCard(options);
    case 'apple_pay':
      return await confirmApplePay();
    case 'google_pay':
      return await confirmGooglePay();
    case 'bank_account':
      return await confirmBankAccount();
    default:
      throw createError('INVALID_METHOD', `Unknown payment method: ${paymentMethod}`);
  }
}

/**
 * Authenticate card with 3D Secure
 *
 * @example
 * ```typescript
 * const result = await Payeez.authenticate3DS({
 *   tokenId: 'tok_xxx',
 *   amount: 1000,
 *   currency: 'usd',
 *   challengeContainerId: '3ds-challenge',
 * });
 *
 * if (result.status === 'authenticated') {
 *   // Proceed with payment
 * }
 * ```
 */
export async function authenticate3DS(options: {
  tokenId: string;
  amount: number;
  currency: string;
  challengeContainerId?: string;
  challengePreference?: ThreeDSConfig['challengePreference'];
}): Promise<ThreeDSResult> {
  if (!state.sessionConfig) {
    throw createError('NOT_MOUNTED', 'Session not initialized');
  }

  // Initiate 3DS authentication
  const response = await resilientFetch<{
    session_id: string;
    status: string;
    challenge_required: boolean;
    challenge_url?: string;
    authentication_value?: string;
    eci?: string;
    ds_transaction_id?: string;
  }>('/threeds-authenticate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.sessionConfig.client_secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: state.sessionConfig.session_id,
      token_id: options.tokenId,
      amount: options.amount,
      currency: options.currency,
      challenge_preference: options.challengePreference || 'no_preference',
    }),
  });

  // Handle challenge if required
  if (response.challenge_required && response.challenge_url) {
    return await handle3DSChallenge(
      response.session_id,
      response.challenge_url,
      options.challengeContainerId
    );
  }

  // Frictionless authentication
  return {
    status: response.status === 'Y' ? 'authenticated' : 'failed',
    authenticationValue: response.authentication_value,
    eci: response.eci,
    dsTransactionId: response.ds_transaction_id,
    liabilityShift: response.status === 'Y',
  };
}

/**
 * Create a network token for a card
 *
 * @example
 * ```typescript
 * const networkToken = await Payeez.createNetworkToken({
 *   tokenId: 'tok_xxx',
 *   requestCryptogram: true,
 * });
 * ```
 */
export async function createNetworkToken(options: {
  tokenId: string;
  requestCryptogram?: boolean;
}): Promise<{
  networkTokenId: string;
  network: string;
  status: string;
  cryptogram?: string;
  expiryMonth: string;
  expiryYear: string;
}> {
  if (!state.sessionConfig) {
    throw createError('NOT_MOUNTED', 'Session not initialized');
  }

  return await resilientFetch('/network-tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.sessionConfig.client_secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: state.sessionConfig.session_id,
      token_id: options.tokenId,
      request_cryptogram: options.requestCryptogram || false,
    }),
  });
}

/**
 * Get cryptogram for an existing network token (for CIT transactions)
 */
export async function getCryptogram(networkTokenId: string): Promise<{
  cryptogram: string;
  cryptogramType: string;
  expiresAt: string;
}> {
  if (!state.sessionConfig) {
    throw createError('NOT_MOUNTED', 'Session not initialized');
  }

  return await resilientFetch(`/network-tokens/${networkTokenId}/cryptogram`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.sessionConfig.client_secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: state.sessionConfig.session_id,
    }),
  });
}

/**
 * Check if Apple Pay is available on this device
 */
export function isApplePayAvailable(): boolean {
  return !!(window as any).ApplePaySession?.canMakePayments?.();
}

/**
 * Check if Google Pay is available
 */
export async function isGooglePayAvailable(): Promise<boolean> {
  if (!state.googlePayClient) return false;
  try {
    const response = await state.googlePayClient.isReadyToPay({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: getGooglePaymentMethods(),
    });
    return response.result;
  } catch {
    return false;
  }
}

/**
 * Get current circuit breaker state
 * Useful for monitoring and debugging
 */
export function getCircuitBreakerState(): {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
} {
  return { ...state.circuitBreaker };
}

/**
 * Get health status of all services
 */
export function getHealthStatus(): Map<string, ServiceHealth> {
  return new Map(state.healthStatus);
}

/**
 * Get pending transactions that need sync
 * These are transactions processed via fallback routes
 */
export function getPendingSyncTransactions(): FallbackTransaction[] {
  return [...state.pendingSyncTransactions];
}

/**
 * Force sync pending transactions
 * Call this when primary service recovers
 */
export async function syncPendingTransactions(): Promise<{
  synced: number;
  failed: number;
}> {
  let synced = 0;
  let failed = 0;

  for (const tx of state.pendingSyncTransactions) {
    try {
      await resilientFetch('/transactions/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.sessionConfig?.client_secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tx),
      });
      synced++;
    } catch {
      failed++;
    }
  }

  // Remove synced transactions
  state.pendingSyncTransactions = state.pendingSyncTransactions.slice(synced);

  return { synced, failed };
}

// ============================================
// Resilience Layer
// ============================================

/**
 * Circuit breaker logic
 */
function shouldUseCircuitBreaker(): boolean {
  const { state: cbState, lastFailureTime } = state.circuitBreaker;
  const recoveryTimeout = globalConfig.resilience.circuitBreaker.recoveryTimeoutMs;

  if (cbState === 'OPEN') {
    if (Date.now() - lastFailureTime >= recoveryTimeout) {
      state.circuitBreaker.state = 'HALF_OPEN';
      state.circuitBreaker.successCount = 0;
      return false;
    }
    return true;
  }

  return false;
}

function recordCircuitBreakerSuccess(): void {
  if (state.circuitBreaker.state === 'HALF_OPEN') {
    state.circuitBreaker.successCount++;
    if (state.circuitBreaker.successCount >= 2) {
      state.circuitBreaker.state = 'CLOSED';
      state.circuitBreaker.failures = 0;
      console.log('[Payeez] Circuit breaker recovered to CLOSED state');
    }
  } else {
    state.circuitBreaker.failures = 0;
  }
}

function recordCircuitBreakerFailure(): void {
  state.circuitBreaker.failures++;
  state.circuitBreaker.lastFailureTime = Date.now();

  if (
    state.circuitBreaker.state === 'HALF_OPEN' ||
    state.circuitBreaker.failures >= globalConfig.resilience.circuitBreaker.failureThreshold
  ) {
    state.circuitBreaker.state = 'OPEN';
    console.warn('[Payeez] Circuit breaker OPEN - switching to failover');
  }
}

/**
 * Make a fetch request with failover support
 */
async function resilientFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const endpoints = globalConfig.resilience.endpoints || [];

  // Check if circuit breaker is open
  const useFailover = shouldUseCircuitBreaker();
  const startIndex = useFailover ? 1 : 0; // Skip primary if circuit is open

  for (let i = startIndex; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const url = endpoint.type === 'payeez'
      ? `${endpoint.url || globalConfig.apiBase}${path}`
      : buildFailoverUrl(endpoint, path, options);

    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const timeoutSignal = 'timeout' in AbortSignal
        ? (AbortSignal as typeof AbortSignal & { timeout: (ms: number) => AbortSignal }).timeout(5000)
        : controller.signal;

      let response: Response;
      try {
        response = await fetch(url, {
          ...options,
          signal: options.signal || timeoutSignal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      // Record success
      if (i === 0) {
        recordCircuitBreakerSuccess();
      }

      // Update health status
      state.healthStatus.set(endpoint.name, {
        status: latencyMs > 1000 ? 'degraded' : 'healthy',
        latencyMs,
        lastCheckAt: new Date(),
      });

      // Track if we used a fallback
      if (i > 0) {
        console.log(`[Payeez] Used fallback endpoint: ${endpoint.name}`);
      }

      return await response.json();
    } catch (error) {
      console.warn(`[Payeez] Endpoint ${endpoint.name} failed:`, error);

      // Update health status
      state.healthStatus.set(endpoint.name, {
        status: 'down',
        latencyMs: 0,
        lastCheckAt: new Date(),
      });

      // Record failure for primary
      if (i === 0) {
        recordCircuitBreakerFailure();
      }

      // Continue to next endpoint
    }
  }

  // All endpoints failed - try emergency direct PSP
  if (globalConfig.resilience.emergency?.enabled) {
    console.warn('[Payeez] All endpoints failed - attempting emergency direct PSP');
    return await emergencyDirectPSP<T>(path, options);
  }

  throw createError('ALL_ENDPOINTS_FAILED', 'All payment endpoints are unavailable');
}

/**
 * Build URL for failover endpoints
 */
function buildFailoverUrl(
  endpoint: FailoverEndpoint,
  path: string,
  options: RequestInit
): string {
  if (endpoint.type === 'basis_theory_reactor') {
    // For reactor, we need to transform the request
    const reactorId = state.sessionConfig?.bt_reactor_id || 'default';
    return `https://api.basistheory.com/reactors/${reactorId}/react`;
  }

  return `${endpoint.url}${path}`;
}

/**
 * Emergency direct PSP call
 * Used when all Payeez endpoints are unavailable
 */
async function emergencyDirectPSP<T>(path: string, options: RequestInit): Promise<T> {
  // This uses Basis Theory proxy to call the PSP directly
  // The merchant's PSP credentials are stored in Basis Theory
  const btApiKey = state.sessionConfig?.basis_theory_key;
  const psp = globalConfig.resilience.emergency?.psp || 'stripe';

  if (!btApiKey) {
    throw createError('EMERGENCY_FAILED', 'Cannot use emergency mode without Basis Theory key');
  }

  const sessionId = state.sessionConfig?.session_id;
  if (!sessionId) {
    throw createError('NOT_READY', 'Session not initialized');
  }

  // Parse the original request to understand what we need to do
  const body = options.body ? JSON.parse(options.body as string) : {};

  // Call Basis Theory proxy to forward to PSP
  const response = await fetch('https://api.basistheory.com/proxy', {
    method: 'POST',
    headers: {
      'BT-API-KEY': btApiKey,
      'BT-PROXY-URL': getPSPUrl(psp),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(transformForPSP(psp, body)),
  });

  if (!response.ok) {
    throw createError('EMERGENCY_FAILED', 'Emergency PSP call failed');
  }

  const result = await response.json();

  // Record this as a fallback transaction for later sync
  state.pendingSyncTransactions.push({
    id: result.id || `emergency_${Date.now()}`,
    session_id: sessionId,
    route: 'emergency_direct_psp',
    data: { ...body, psp, result },
    timestamp: new Date(),
  });

  return result as T;
}

/**
 * Get PSP URL for emergency direct calls
 */
function getPSPUrl(psp: string): string {
  const urls: Record<string, string> = {
    stripe: 'https://api.stripe.com/v1/payment_intents',
    adyen: 'https://checkout-test.adyen.com/v71/payments',
    braintree: 'https://payments.braintree-api.com/graphql',
  };
  return urls[psp] || urls.stripe;
}

/**
 * Transform request body for specific PSP
 */
function transformForPSP(psp: string, body: any): any {
  // This is a simplified transformation
  // In production, this would be more comprehensive
  switch (psp) {
    case 'stripe':
      return {
        amount: body.amount,
        currency: body.currency,
        confirm: true,
      };
    case 'adyen':
      return {
        amount: { value: body.amount, currency: body.currency?.toUpperCase() },
        reference: body.reference || `ref_${Date.now()}`,
      };
    default:
      return body;
  }
}

/**
 * Start health monitoring
 */
function startHealthMonitoring(): void {
  if (healthCheckInterval) return;

  const checkHealth = async () => {
    for (const endpoint of globalConfig.resilience.endpoints || []) {
      try {
        const url = endpoint.type === 'payeez'
          ? `${endpoint.url || globalConfig.apiBase}/health`
          : null;

        if (!url) continue;

        const startTime = Date.now();
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });

        const latencyMs = Date.now() - startTime;

        state.healthStatus.set(endpoint.name, {
          status: response.ok ? (latencyMs > 1000 ? 'degraded' : 'healthy') : 'down',
          latencyMs,
          lastCheckAt: new Date(),
        });
      } catch {
        state.healthStatus.set(endpoint.name, {
          status: 'down',
          latencyMs: 0,
          lastCheckAt: new Date(),
        });
      }
    }
  };

  // Initial check
  checkHealth();

  // Periodic checks
  healthCheckInterval = setInterval(
    checkHealth,
    globalConfig.resilience.circuitBreaker.healthCheckIntervalMs
  );
}

// ============================================
// Vault Initialization
// ============================================

async function initializeVaults(config: PayeezMountConfig): Promise<void> {
  const vaultConfig = config.resilience?.vaults || globalConfig.resilience.vaults;

  // Initialize primary vault
  if (state.vaultProvider === 'vgs' && state.sessionConfig?.vgs_vault_id) {
    await initVGSCollect(
      state.sessionConfig.vgs_vault_id,
      (state.sessionConfig.vgs_environment as 'sandbox' | 'live') || 'sandbox'
    );
  } else {
    state.vaultProvider = 'basis_theory';
    await initBasisTheory(state.sessionConfig!.basis_theory_key!);
  }

  // Initialize fallback vault if dual-write enabled
  if (vaultConfig.dualWrite && vaultConfig.fallback) {
    if (vaultConfig.fallback === 'vgs' && state.sessionConfig?.vgs_vault_id) {
      await initVGSCollect(
        state.sessionConfig.vgs_vault_id,
        (state.sessionConfig.vgs_environment as 'sandbox' | 'live') || 'sandbox'
      );
    } else if (vaultConfig.fallback === 'basis_theory') {
      await initBasisTheory(state.sessionConfig!.basis_theory_key!);
    }
  }
}

async function initBasisTheory(publicKey: string): Promise<void> {
  const { BasisTheory } = await import('@basis-theory/basis-theory-js');
  state.basisTheory = await new BasisTheory().init(publicKey, { elements: true });
}

async function initVGSCollect(vaultId: string, environment: 'sandbox' | 'live'): Promise<void> {
  await loadVGSScript();
  const env = environment === 'live' ? 'live' : 'sandbox';
  state.vgsCollect = (window as any).VGSCollect.create(vaultId, env, (formState: any) => {
    console.log('[Payeez] VGS form state:', formState);
  });
}

function loadVGSScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).VGSCollect) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.verygoodvault.com/vgs-collect/2.18.0/vgs-collect.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load VGS Collect SDK'));
    document.head.appendChild(script);
  });
}

// ============================================
// 3D Secure Handling
// ============================================

async function handle3DSChallenge(
  sessionId: string,
  challengeUrl: string,
  containerId?: string
): Promise<ThreeDSResult> {
  return new Promise((resolve, reject) => {
    // Create iframe for challenge
    const container = containerId
      ? document.getElementById(containerId)
      : document.body;

    if (!container) {
      reject(createError('3DS_ERROR', 'Challenge container not found'));
      return;
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'payeez-3ds-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const iframeContainer = document.createElement('div');
    iframeContainer.style.cssText = `
      background: white;
      border-radius: 12px;
      overflow: hidden;
      width: 90%;
      max-width: 400px;
      max-height: 600px;
    `;

    const iframe = document.createElement('iframe');
    iframe.src = challengeUrl;
    iframe.style.cssText = `
      width: 100%;
      height: 500px;
      border: none;
    `;

    iframeContainer.appendChild(iframe);
    overlay.appendChild(iframeContainer);
    container.appendChild(overlay);

    // Listen for 3DS completion message
    const messageHandler = async (event: MessageEvent) => {
      if (event.data?.type === 'payeez-3ds-complete') {
        window.removeEventListener('message', messageHandler);
        overlay.remove();

        // Fetch final result
        try {
          const result = await resilientFetch<{
            status: string;
            authentication_value?: string;
            eci?: string;
            ds_transaction_id?: string;
          }>(`/threeds-authenticate/sessions/${sessionId}/result`, {
            headers: {
              Authorization: `Bearer ${state.sessionConfig?.client_secret}`,
            },
          });

          resolve({
            status: result.status === 'Y' ? 'authenticated' : 'failed',
            authenticationValue: result.authentication_value,
            eci: result.eci,
            dsTransactionId: result.ds_transaction_id,
            liabilityShift: result.status === 'Y',
          });
        } catch (error) {
          reject(normalizeError(error));
        }
      }
    };

    window.addEventListener('message', messageHandler);

    // Timeout after 10 minutes
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      overlay.remove();
      resolve({
        status: 'failed',
        liabilityShift: false,
      });
    }, 600000);
  });
}

// ============================================
// Payment Methods Rendering
// ============================================

async function renderPaymentMethods(
  container: HTMLElement,
  config: PayeezMountConfig
): Promise<void> {
  const methods = state.sessionConfig!.payment_methods || ['card'];

  if (methods.length > 1) {
    const tabs = createMethodTabs(methods);
    container.appendChild(tabs);
  }

  const contentArea = document.createElement('div');
  contentArea.id = 'payeez-content';
  container.appendChild(contentArea);

  state.activeMethod = methods[0];
  await renderMethodContent(contentArea, methods[0], config);
}

function createMethodTabs(methods: PaymentMethodType[]): HTMLElement {
  const tabContainer = document.createElement('div');
  tabContainer.className = 'payeez-tabs';
  tabContainer.style.cssText = `
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 8px;
  `;

  const methodLabels: Record<PaymentMethodType, string> = {
    card: 'Card',
    apple_pay: 'Apple Pay',
    google_pay: 'Google Pay',
    bank_account: 'Bank Account',
  };

  methods.forEach((method, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `payeez-tab ${index === 0 ? 'active' : ''}`;
    tab.dataset.method = method;
    tab.textContent = methodLabels[method];
    tab.style.cssText = `
      padding: 8px 16px;
      border: none;
      background: ${index === 0 ? '#0066ff' : 'transparent'};
      color: ${index === 0 ? 'white' : '#666'};
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    `;

    tab.addEventListener('click', async () => {
      tabContainer.querySelectorAll('.payeez-tab').forEach((t) => {
        (t as HTMLElement).style.background = 'transparent';
        (t as HTMLElement).style.color = '#666';
        t.classList.remove('active');
      });
      tab.style.background = '#0066ff';
      tab.style.color = 'white';
      tab.classList.add('active');

      state.activeMethod = method;
      const contentArea = document.getElementById('payeez-content')!;
      contentArea.innerHTML = '';
      await renderMethodContent(contentArea, method, state.config!);
    });

    tabContainer.appendChild(tab);
  });

  return tabContainer;
}

async function renderMethodContent(
  container: HTMLElement,
  method: PaymentMethodType,
  config: PayeezMountConfig
): Promise<void> {
  switch (method) {
    case 'card':
      await mountCardElement(container, config.appearance);
      break;
    case 'apple_pay':
      await renderApplePayButton(container, config);
      break;
    case 'google_pay':
      await renderGooglePayButton(container, config);
      break;
    case 'bank_account':
      await mountBankAccountForm(container, config.appearance);
      break;
  }
}

async function mountCardElement(
  container: HTMLElement,
  appearance?: PayeezMountConfig['appearance']
): Promise<void> {
  if (state.vaultProvider === 'vgs') {
    await mountVGSCardElement(container, appearance);
  } else {
    await mountBasisTheoryCardElement(container, appearance);
  }
  setupFormHandler(container);
}

async function mountBasisTheoryCardElement(
  container: HTMLElement,
  appearance?: PayeezMountConfig['appearance']
): Promise<void> {
  const wrapper = document.createElement('div');
  wrapper.id = 'payeez-card-element';
  wrapper.style.cssText = `
    padding: 12px;
    border: 1px solid #e0e0e0;
    border-radius: ${appearance?.variables?.borderRadius || '8px'};
    background: ${appearance?.variables?.colorBackground || '#ffffff'};
  `;
  container.appendChild(wrapper);

  state.cardElement = state.basisTheory.createElement('card', {
    style: {
      base: {
        color: appearance?.variables?.colorText || '#1a1a1a',
        fontSize: '16px',
        fontFamily: appearance?.variables?.fontFamily || 'system-ui, sans-serif',
        '::placeholder': { color: '#a0a0a0' },
      },
      invalid: { color: '#dc2626' },
    },
  });

  await state.cardElement.mount('#payeez-card-element');
}

async function mountVGSCardElement(
  container: HTMLElement,
  appearance?: PayeezMountConfig['appearance']
): Promise<void> {
  const borderRadius = appearance?.variables?.borderRadius || '8px';
  const bgColor = appearance?.variables?.colorBackground || '#ffffff';
  const textColor = appearance?.variables?.colorText || '#1a1a1a';
  const fontFamily = appearance?.variables?.fontFamily || 'system-ui, sans-serif';

  const form = document.createElement('div');
  form.className = 'payeez-vgs-card-form';
  form.innerHTML = `
    <div style="margin-bottom: 12px;">
      <div id="vgs-card-number" style="
        padding: 12px;
        border: 1px solid #e0e0e0;
        border-radius: ${borderRadius};
        background: ${bgColor};
        min-height: 20px;
      "></div>
    </div>
    <div style="display: flex; gap: 12px;">
      <div style="flex: 1;">
        <div id="vgs-card-expiry" style="
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: ${borderRadius};
          background: ${bgColor};
          min-height: 20px;
        "></div>
      </div>
      <div style="flex: 1;">
        <div id="vgs-card-cvc" style="
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: ${borderRadius};
          background: ${bgColor};
          min-height: 20px;
        "></div>
      </div>
    </div>
  `;
  container.appendChild(form);

  const fieldStyles = {
    color: textColor,
    fontSize: '16px',
    fontFamily: fontFamily,
    '&::placeholder': { color: '#a0a0a0' },
  };

  state.vgsCollect.field('#vgs-card-number', {
    type: 'card-number',
    name: 'card_number',
    placeholder: '4111 1111 1111 1111',
    validations: ['required', 'validCardNumber'],
    css: fieldStyles,
  });

  state.vgsCollect.field('#vgs-card-expiry', {
    type: 'card-expiration-date',
    name: 'card_expiry',
    placeholder: 'MM / YY',
    validations: ['required', 'validCardExpirationDate'],
    css: fieldStyles,
  });

  state.vgsCollect.field('#vgs-card-cvc', {
    type: 'card-security-code',
    name: 'card_cvc',
    placeholder: 'CVC',
    validations: ['required', 'validCardSecurityCode'],
    css: fieldStyles,
  });

  state.cardElement = { type: 'vgs' };
}

async function mountBankAccountForm(
  container: HTMLElement,
  appearance?: PayeezMountConfig['appearance']
): Promise<void> {
  const form = document.createElement('div');
  form.className = 'payeez-bank-form';
  form.innerHTML = `
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-size: 14px; color: #666;">Account Holder Name</label>
      <input type="text" id="payeez-account-holder" placeholder="John Doe" style="
        width: 100%;
        padding: 12px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font-size: 16px;
        box-sizing: border-box;
      " />
    </div>
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-size: 14px; color: #666;">Account Type</label>
      <select id="payeez-account-type" style="
        width: 100%;
        padding: 12px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font-size: 16px;
        box-sizing: border-box;
      ">
        <option value="checking">Checking</option>
        <option value="savings">Savings</option>
      </select>
    </div>
    <div id="payeez-bank-element" style="
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: ${appearance?.variables?.colorBackground || '#ffffff'};
    "></div>
  `;
  container.appendChild(form);

  state.bankElement = state.basisTheory.createElement('text', {
    targetId: 'routing_number',
    placeholder: 'Routing Number',
    style: {
      base: {
        color: appearance?.variables?.colorText || '#1a1a1a',
        fontSize: '16px',
      },
    },
  });

  await state.bankElement.mount('#payeez-bank-element');
  setupFormHandler(container);
}

async function renderApplePayButton(
  container: HTMLElement,
  config: PayeezMountConfig
): Promise<void> {
  if (!isApplePayAvailable()) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #666; background: #f5f5f5; border-radius: 8px;">
        Apple Pay is not available on this device or browser.
      </div>
    `;
    return;
  }

  const buttonType = config.applePayButtonOptions?.type || 'pay';
  const buttonColor = config.applePayButtonOptions?.color || 'black';

  const button = document.createElement('apple-pay-button');
  button.setAttribute('buttonstyle', buttonColor);
  button.setAttribute('type', buttonType);
  button.setAttribute('locale', 'en-US');
  button.style.cssText = `
    --apple-pay-button-width: 100%;
    --apple-pay-button-height: 48px;
    --apple-pay-button-border-radius: 8px;
    cursor: pointer;
  `;

  button.addEventListener('click', () => startApplePaySession());
  container.appendChild(button);

  if (!document.getElementById('apple-pay-button-styles')) {
    const style = document.createElement('style');
    style.id = 'apple-pay-button-styles';
    style.textContent = `apple-pay-button { display: block; }`;
    document.head.appendChild(style);
  }
}

async function renderGooglePayButton(
  container: HTMLElement,
  config: PayeezMountConfig
): Promise<void> {
  await loadGooglePayScript();

  const gpConfig = state.sessionConfig!.google_pay;
  if (!gpConfig) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #666; background: #f5f5f5; border-radius: 8px;">
        Google Pay is not configured.
      </div>
    `;
    return;
  }

  state.googlePayClient = new (window as any).google.payments.api.PaymentsClient({
    environment: gpConfig.environment,
  });

  const isReady = await isGooglePayAvailable();
  if (!isReady) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #666; background: #f5f5f5; border-radius: 8px;">
        Google Pay is not available.
      </div>
    `;
    return;
  }

  const button = state.googlePayClient.createButton({
    onClick: () => startGooglePayFlow(),
    buttonColor: config.googlePayButtonOptions?.color || 'default',
    buttonType: config.googlePayButtonOptions?.type || 'pay',
    buttonSizeMode: 'fill',
  });
  button.style.width = '100%';
  container.appendChild(button);
}

function loadGooglePayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.payments?.api) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://pay.google.com/gp/p/js/pay.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Pay SDK'));
    document.head.appendChild(script);
  });
}

function setupFormHandler(container: HTMLElement): void {
  const form = container.closest('form');
  if (!form) {
    console.warn('[Payeez] No parent form found. Call confirm() manually.');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payment = await confirm();
      state.config?.onSuccess?.(payment);
    } catch (err) {
      state.config?.onError?.(normalizeError(err));
    }
  });
}

// ============================================
// Payment Confirmation
// ============================================

async function confirmCard(options?: {
  threeds?: ThreeDSConfig;
  networkToken?: boolean;
}): Promise<Payment> {
  if (!state.cardElement || !state.sessionConfig) {
    throw createError('NOT_READY', 'Card element not initialized');
  }

  let tokenId: string;

  // Tokenize card
  if (state.vaultProvider === 'vgs') {
    tokenId = await tokenizeWithVGS();
  } else {
    tokenId = await tokenizeWithBasisTheory();
  }

  // 3DS authentication if configured
  let threeDSResult: ThreeDSResult | undefined;
  if (options?.threeds || state.config?.threeds) {
    const threeDSConfig = options?.threeds || state.config?.threeds;

    threeDSConfig?.onChallengeRequired?.();

    threeDSResult = await authenticate3DS({
      tokenId,
      amount: state.sessionConfig.amount,
      currency: state.sessionConfig.currency,
      challengeContainerId: threeDSConfig?.challengeContainerId,
      challengePreference: threeDSConfig?.challengePreference,
    });

    threeDSConfig?.onChallengeComplete?.(threeDSResult);

    if (threeDSResult.status === 'failed') {
      throw createError('3DS_FAILED', '3D Secure authentication failed');
    }
  }

  // Create network token if requested
  let networkTokenId: string | undefined;
  if (options?.networkToken || state.config?.networkTokens?.enabled) {
    try {
      const networkToken = await createNetworkToken({
        tokenId,
        requestCryptogram: state.config?.networkTokens?.requestCryptogram,
      });
      networkTokenId = networkToken.networkTokenId;
    } catch (error) {
      console.warn('[Payeez] Network token creation failed, continuing without', error);
    }
  }

  // Send confirmation
  return await sendConfirmation({
    payment_method_type: 'card',
    token_id: tokenId,
    token_provider: state.vaultProvider,
    threeds: threeDSResult
      ? {
          authentication_value: threeDSResult.authenticationValue,
          eci: threeDSResult.eci,
          ds_transaction_id: threeDSResult.dsTransactionId,
        }
      : undefined,
    network_token_id: networkTokenId,
  });
}

async function tokenizeWithBasisTheory(): Promise<string> {
  if (!state.basisTheory || !state.cardElement) {
    throw createError('NOT_READY', 'Basis Theory not initialized');
  }

  const token = await state.basisTheory.tokens.create({
    type: 'card',
    data: state.cardElement,
  });

  return token.id;
}

async function tokenizeWithVGS(): Promise<string> {
  return new Promise((resolve, reject) => {
    state.vgsCollect.submit(
      '/post',
      {},
      (status: number, data: any) => {
        if (status !== 200) {
          reject(createError('VGS_ERROR', data?.message || 'VGS submission failed'));
          return;
        }
        resolve(data.card_number);
      },
      (errors: any) => {
        const errorMessages = Object.values(errors)
          .map((e: any) => e.errorMessages?.join(', '))
          .filter(Boolean)
          .join('; ');
        reject(createError('VALIDATION_ERROR', errorMessages || 'Card validation failed'));
      }
    );
  });
}

async function confirmBankAccount(): Promise<Payment> {
  if (!state.basisTheory || !state.bankElement || !state.sessionConfig) {
    throw createError('NOT_READY', 'Bank element not initialized');
  }

  const holderName = (document.getElementById('payeez-account-holder') as HTMLInputElement)?.value;
  const accountType = (document.getElementById('payeez-account-type') as HTMLSelectElement)?.value;

  const token = await state.basisTheory.tokens.create({
    type: 'bank',
    data: state.bankElement,
  });

  return await sendConfirmation({
    payment_method_type: 'bank_account',
    token_id: token.id,
    token_provider: 'basis_theory',
    bank_account: {
      account_holder_name: holderName,
      account_type: accountType as 'checking' | 'savings',
    },
  });
}

function startApplePaySession(): void {
  const session = state.sessionConfig!;
  const applePayConfig = session.apple_pay!;

  const paymentRequest = {
    countryCode: applePayConfig.country_code,
    currencyCode: session.currency,
    supportedNetworks: applePayConfig.supported_networks,
    merchantCapabilities: ['supports3DS'],
    total: {
      label: applePayConfig.merchant_name,
      amount: (session.amount / 100).toFixed(2),
    },
  };

  state.applePaySession = new (window as any).ApplePaySession(3, paymentRequest);

  state.applePaySession.onvalidatemerchant = async (event: any) => {
    try {
      const res = await resilientFetch<any>('/apple-pay-validate-merchant', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.client_secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          validation_url: event.validationURL,
          domain: window.location.hostname,
          session_id: session.session_id,
        }),
      });
      state.applePaySession.completeMerchantValidation(res);
    } catch (err) {
      state.applePaySession.abort();
      state.config?.onError?.(normalizeError(err));
    }
  };

  state.applePaySession.onpaymentauthorized = async (event: any) => {
    try {
      const payment = await confirmApplePay(event.payment.token);
      state.applePaySession.completePayment((window as any).ApplePaySession.STATUS_SUCCESS);
      state.config?.onSuccess?.(payment);
    } catch (err) {
      state.applePaySession.completePayment((window as any).ApplePaySession.STATUS_FAILURE);
      state.config?.onError?.(normalizeError(err));
    }
  };

  state.applePaySession.begin();
}

async function confirmApplePay(applePayToken?: any): Promise<Payment> {
  if (!state.sessionConfig) {
    throw createError('NOT_READY', 'Session not initialized');
  }

  return await sendConfirmation({
    payment_method_type: 'apple_pay',
    token_id: '',
    token_provider: 'basis_theory',
    apple_pay_token: JSON.stringify(applePayToken),
  });
}

async function startGooglePayFlow(): Promise<void> {
  const session = state.sessionConfig!;
  const gpConfig = session.google_pay!;

  const paymentDataRequest = {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: getGooglePaymentMethods(),
    transactionInfo: {
      totalPriceStatus: 'FINAL',
      totalPrice: (session.amount / 100).toFixed(2),
      currencyCode: session.currency,
      countryCode: 'US',
    },
    merchantInfo: {
      merchantId: gpConfig.merchant_id,
      merchantName: gpConfig.merchant_name,
    },
  };

  try {
    const paymentData = await state.googlePayClient.loadPaymentData(paymentDataRequest);
    const payment = await confirmGooglePay(paymentData);
    state.config?.onSuccess?.(payment);
  } catch (err: any) {
    if (err.statusCode !== 'CANCELED') {
      state.config?.onError?.(normalizeError(err));
    }
  }
}

function getGooglePaymentMethods(): any[] {
  const gpConfig = state.sessionConfig?.google_pay;
  return [
    {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: gpConfig?.allowed_card_networks || ['VISA', 'MASTERCARD', 'AMEX'],
      },
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: {
          gateway: 'basistheory',
          gatewayMerchantId: state.sessionConfig?.session_id,
        },
      },
    },
  ];
}

async function confirmGooglePay(paymentData?: any): Promise<Payment> {
  if (!state.sessionConfig) {
    throw createError('NOT_READY', 'Session not initialized');
  }

  return await sendConfirmation({
    payment_method_type: 'google_pay',
    token_id: '',
    token_provider: 'basis_theory',
    google_pay_token: JSON.stringify(paymentData),
  });
}

async function sendConfirmation(payload: any): Promise<Payment> {
  return await resilientFetch<Payment>(
    `/confirm-payment/${state.sessionConfig!.session_id}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.sessionConfig!.client_secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
}

// ============================================
// Error Handling
// ============================================

function createError(code: string, message: string): PayeezError {
  return { code, message };
}

function normalizeError(err: unknown): PayeezError {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return err as PayeezError;
  }
  if (err instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: err.message };
  }
  return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' };
}

// ============================================
// Exports
// ============================================

export const Payeez = {
  configure,
  mount,
  unmount,
  confirm,
  authenticate3DS,
  createNetworkToken,
  getCryptogram,
  isApplePayAvailable,
  isGooglePayAvailable,
  getCircuitBreakerState,
  getHealthStatus,
  getPendingSyncTransactions,
  syncPendingTransactions,
};

export default Payeez;
