// Resilience utilities for multi-region failover and health monitoring

export interface ServiceHealth {
  serviceName: string;
  region: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  lastCheckAt: Date;
  consecutiveFailures: number;
}

export interface FailoverEndpoint {
  name: string;
  type: 'atlas' | 'basis_theory_reactor' | 'direct_psp';
  region?: string;
  url?: string;
}

export interface ResilienceConfig {
  failoverChain: FailoverEndpoint[];
  circuitBreakerThreshold: number;
  circuitBreakerRecoveryMs: number;
  emergencyPsp?: string;
  primaryVault: string;
  fallbackVault?: string;
  dualVaultEnabled: boolean;
}

// Circuit breaker states
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private readonly threshold: number = 3,
    private readonly recoveryTimeMs: number = 30000,
    private readonly halfOpenSuccessThreshold: number = 2
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<{ result: T; usedFallback: boolean }> {
    // Check if we should try to recover
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else if (fallback) {
        return { result: await fallback(), usedFallback: true };
      } else {
        throw new Error('Circuit breaker is OPEN and no fallback provided');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return { result, usedFallback: false };
    } catch (error) {
      this.onFailure();

      if (fallback && this.state === 'OPEN') {
        return { result: await fallback(), usedFallback: true };
      }

      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}

// Health checker for services
export class HealthChecker {
  private healthCache: Map<string, ServiceHealth> = new Map();
  private readonly cacheTtlMs = 10000; // 10 seconds

  async checkHealth(
    serviceName: string,
    healthCheckFn: () => Promise<{ healthy: boolean; latencyMs?: number }>
  ): Promise<ServiceHealth> {
    const cacheKey = serviceName;
    const cached = this.healthCache.get(cacheKey);

    if (cached && Date.now() - cached.lastCheckAt.getTime() < this.cacheTtlMs) {
      return cached;
    }

    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'down' = 'down';
    let latencyMs: number | undefined;

    try {
      const result = await Promise.race([
        healthCheckFn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        ),
      ]);

      latencyMs = result.latencyMs ?? Date.now() - startTime;
      status = result.healthy ? (latencyMs > 1000 ? 'degraded' : 'healthy') : 'down';
    } catch {
      status = 'down';
      latencyMs = Date.now() - startTime;
    }

    const health: ServiceHealth = {
      serviceName,
      region: 'us', // Default, can be overridden
      status,
      latencyMs,
      lastCheckAt: new Date(),
      consecutiveFailures: status === 'down' ? (cached?.consecutiveFailures ?? 0) + 1 : 0,
    };

    this.healthCache.set(cacheKey, health);
    return health;
  }

  getHealthyServices(): ServiceHealth[] {
    return Array.from(this.healthCache.values()).filter(
      (h) => h.status !== 'down' && Date.now() - h.lastCheckAt.getTime() < this.cacheTtlMs * 3
    );
  }
}

// Failover executor - tries endpoints in order until one succeeds
export class FailoverExecutor {
  constructor(
    private readonly endpoints: FailoverEndpoint[],
    private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map()
  ) {
    // Initialize circuit breakers for each endpoint
    for (const endpoint of endpoints) {
      if (!this.circuitBreakers.has(endpoint.name)) {
        this.circuitBreakers.set(endpoint.name, new CircuitBreaker());
      }
    }
  }

  async execute<T>(
    operation: (endpoint: FailoverEndpoint) => Promise<T>
  ): Promise<{ result: T; endpointUsed: FailoverEndpoint; attemptedEndpoints: string[] }> {
    const attemptedEndpoints: string[] = [];
    let lastError: Error | null = null;

    for (const endpoint of this.endpoints) {
      const circuitBreaker = this.circuitBreakers.get(endpoint.name)!;

      // Skip if circuit is open
      if (circuitBreaker.getState() === 'OPEN') {
        attemptedEndpoints.push(`${endpoint.name} (circuit open)`);
        continue;
      }

      attemptedEndpoints.push(endpoint.name);

      try {
        const { result } = await circuitBreaker.execute(() => operation(endpoint));
        return { result, endpointUsed: endpoint, attemptedEndpoints };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Endpoint ${endpoint.name} failed:`, lastError.message);
      }
    }

    throw new Error(
      `All endpoints failed. Attempted: ${attemptedEndpoints.join(', ')}. Last error: ${lastError?.message}`
    );
  }

  getCircuitBreakerStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    for (const [name, cb] of this.circuitBreakers) {
      states[name] = cb.getState();
    }
    return states;
  }
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Dual-write to multiple vaults
export async function dualVaultTokenize(
  cardData: {
    number: string;
    expiration_month: number;
    expiration_year: number;
    cvc: string;
  },
  vaults: {
    primary: { tokenize: (data: typeof cardData) => Promise<string> };
    fallback?: { tokenize: (data: typeof cardData) => Promise<string> };
  },
  options: { parallel?: boolean } = {}
): Promise<{ primary?: string; fallback?: string }> {
  const results: { primary?: string; fallback?: string } = {};

  if (options.parallel && vaults.fallback) {
    // Tokenize in parallel
    const [primaryResult, fallbackResult] = await Promise.allSettled([
      vaults.primary.tokenize(cardData),
      vaults.fallback.tokenize(cardData),
    ]);

    if (primaryResult.status === 'fulfilled') {
      results.primary = primaryResult.value;
    }
    if (fallbackResult.status === 'fulfilled') {
      results.fallback = fallbackResult.value;
    }
  } else {
    // Tokenize sequentially (primary first)
    try {
      results.primary = await vaults.primary.tokenize(cardData);
    } catch (error) {
      console.error('Primary vault tokenization failed:', error);
    }

    if (vaults.fallback) {
      try {
        results.fallback = await vaults.fallback.tokenize(cardData);
      } catch (error) {
        console.error('Fallback vault tokenization failed:', error);
      }
    }
  }

  if (!results.primary && !results.fallback) {
    throw new Error('All vault tokenization attempts failed');
  }

  return results;
}

// Generate a fallback transaction record
export interface FallbackTransactionRecord {
  merchantId: string;
  paymentSessionId?: string;
  fallbackRoute: string;
  originalRoute: string;
  amount: number;
  currency: string;
  psp: string;
  pspTransactionId?: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export function createFallbackTransactionRecord(
  data: FallbackTransactionRecord
): FallbackTransactionRecord {
  return {
    ...data,
    metadata: {
      ...data.metadata,
      recordedAt: new Date().toISOString(),
      requiresSync: true,
    },
  };
}
