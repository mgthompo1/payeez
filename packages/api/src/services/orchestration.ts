// ============================================
// Payment Orchestration Service
// Handles routing, failover, and retry logic
// ============================================

import { createPSPAdapter } from '../adapters'
import type {
  PSPName,
  PSPCredentials,
  PSPChargeRequest,
  PSPChargeResponse,
  FailureCategory,
} from '../types'

interface OrchestrationConfig {
  trafficRules: TrafficRule[]
  retryRules: RetryRule[]
  pspCredentials: Map<PSPName, PSPCredentials>
  circuitBreaker: CircuitBreakerConfig
}

interface TrafficRule {
  psp: PSPName
  weight: number
  conditions?: {
    currencies?: string[]
    amount_gte?: number
    amount_lte?: number
    card_brands?: string[]
  }
  is_active: boolean
}

interface RetryRule {
  source_psp: PSPName
  target_psp: PSPName
  failure_codes?: string[]
  failure_categories?: FailureCategory[]
  max_retries: number
}

interface CircuitBreakerConfig {
  threshold: number // Number of failures before opening
  recovery_ms: number // Time before trying again
}

interface CircuitBreakerState {
  failures: number
  last_failure: number
  is_open: boolean
}

export class OrchestrationService {
  private config: OrchestrationConfig
  private circuitBreakers: Map<PSPName, CircuitBreakerState> = new Map()

  constructor(config: OrchestrationConfig) {
    this.config = config
  }

  /**
   * Select the best PSP for a payment based on routing rules
   */
  selectPSP(request: {
    amount: number
    currency: string
    card_brand?: string
  }): PSPName | null {
    // Filter active rules that match conditions
    const matchingRules = this.config.trafficRules.filter(rule => {
      if (!rule.is_active) return false
      if (this.isCircuitOpen(rule.psp)) return false

      const conditions = rule.conditions
      if (!conditions) return true

      if (conditions.currencies && !conditions.currencies.includes(request.currency)) {
        return false
      }
      if (conditions.amount_gte && request.amount < conditions.amount_gte) {
        return false
      }
      if (conditions.amount_lte && request.amount > conditions.amount_lte) {
        return false
      }
      if (conditions.card_brands && request.card_brand &&
          !conditions.card_brands.includes(request.card_brand)) {
        return false
      }

      return true
    })

    if (matchingRules.length === 0) return null

    // Weighted random selection
    const totalWeight = matchingRules.reduce((sum, rule) => sum + rule.weight, 0)
    let random = Math.random() * totalWeight

    for (const rule of matchingRules) {
      random -= rule.weight
      if (random <= 0) {
        return rule.psp
      }
    }

    return matchingRules[0].psp
  }

  /**
   * Get the retry PSP for a failed payment
   */
  getRetryPSP(
    sourcePsp: PSPName,
    failureCategory: FailureCategory,
    attemptNumber: number
  ): PSPName | null {
    const applicableRules = this.config.retryRules.filter(rule => {
      if (rule.source_psp !== sourcePsp) return false
      if (this.isCircuitOpen(rule.target_psp)) return false
      if (attemptNumber >= rule.max_retries) return false

      // Check if this failure category should trigger retry
      if (rule.failure_categories &&
          !rule.failure_categories.includes(failureCategory)) {
        return false
      }

      return true
    })

    if (applicableRules.length === 0) return null

    // Return the first applicable rule's target PSP
    return applicableRules[0].target_psp
  }

  /**
   * Execute a payment with orchestration (routing + retry)
   */
  async executePayment(
    request: PSPChargeRequest,
    context: { currency: string; card_brand?: string }
  ): Promise<{
    response: PSPChargeResponse
    psp: PSPName
    attempts: Array<{ psp: PSPName; response: PSPChargeResponse }>
  }> {
    const attempts: Array<{ psp: PSPName; response: PSPChargeResponse }> = []
    let currentPsp = this.selectPSP({
      amount: request.amount,
      currency: context.currency,
      card_brand: context.card_brand,
    })

    if (!currentPsp) {
      throw new Error('No PSP available for this payment')
    }

    let attemptNumber = 0
    const maxAttempts = 3

    while (attemptNumber < maxAttempts) {
      const credentials = this.config.pspCredentials.get(currentPsp)
      if (!credentials) {
        throw new Error(`No credentials configured for ${currentPsp}`)
      }

      const adapter = createPSPAdapter(currentPsp, credentials)

      try {
        const response = await adapter.charge({
          ...request,
          idempotency_key: `${request.idempotency_key}_${attemptNumber}`,
        })

        attempts.push({ psp: currentPsp, response })

        if (response.success) {
          // Success - record healthy PSP
          this.recordSuccess(currentPsp)
          return { response, psp: currentPsp, attempts }
        }

        // Failed - check if we should retry
        if (response.requires_action) {
          // 3DS required - don't retry, return as-is
          return { response, psp: currentPsp, attempts }
        }

        const failureCategory = response.failure_category || 'unknown'

        // Record failure for circuit breaker
        this.recordFailure(currentPsp)

        // Check if this is a retryable failure
        if (!this.isRetryableFailure(failureCategory)) {
          return { response, psp: currentPsp, attempts }
        }

        // Try to get a retry PSP
        const retryPsp = this.getRetryPSP(currentPsp, failureCategory, attemptNumber)

        if (!retryPsp) {
          return { response, psp: currentPsp, attempts }
        }

        currentPsp = retryPsp
        attemptNumber++

      } catch (error) {
        // Network/system error - record failure and try next PSP
        this.recordFailure(currentPsp)

        attempts.push({
          psp: currentPsp,
          response: {
            success: false,
            transaction_id: '',
            status: 'failed',
            amount: request.amount,
            currency: context.currency,
            failure_code: 'network_error',
            failure_message: error instanceof Error ? error.message : 'Network error',
            failure_category: 'processing_error',
            raw_response: {},
          },
        })

        const retryPsp = this.getRetryPSP(currentPsp, 'processing_error', attemptNumber)

        if (!retryPsp) {
          throw error
        }

        currentPsp = retryPsp
        attemptNumber++
      }
    }

    // Max attempts reached
    const lastAttempt = attempts[attempts.length - 1]
    return {
      response: lastAttempt.response,
      psp: lastAttempt.psp,
      attempts,
    }
  }

  /**
   * Check if a failure category is retryable
   */
  private isRetryableFailure(category: FailureCategory): boolean {
    const nonRetryable: FailureCategory[] = [
      'insufficient_funds',
      'expired_card',
      'invalid_card',
      'invalid_cvc',
      'fraud_suspected',
    ]
    return !nonRetryable.includes(category)
  }

  /**
   * Circuit breaker methods
   */
  private isCircuitOpen(psp: PSPName): boolean {
    const state = this.circuitBreakers.get(psp)
    if (!state) return false

    if (!state.is_open) return false

    // Check if recovery time has passed
    const now = Date.now()
    if (now - state.last_failure > this.config.circuitBreaker.recovery_ms) {
      // Allow a test request (half-open state)
      state.is_open = false
      return false
    }

    return true
  }

  private recordFailure(psp: PSPName): void {
    let state = this.circuitBreakers.get(psp)
    if (!state) {
      state = { failures: 0, last_failure: 0, is_open: false }
      this.circuitBreakers.set(psp, state)
    }

    state.failures++
    state.last_failure = Date.now()

    if (state.failures >= this.config.circuitBreaker.threshold) {
      state.is_open = true
    }
  }

  private recordSuccess(psp: PSPName): void {
    const state = this.circuitBreakers.get(psp)
    if (state) {
      state.failures = 0
      state.is_open = false
    }
  }

  /**
   * Get health status of all PSPs
   */
  async checkAllHealth(): Promise<Map<PSPName, { healthy: boolean; latency_ms: number }>> {
    const results = new Map<PSPName, { healthy: boolean; latency_ms: number }>()

    for (const [psp, credentials] of this.config.pspCredentials) {
      try {
        const adapter = createPSPAdapter(psp, credentials)
        const health = await adapter.healthCheck()
        results.set(psp, health)

        if (health.healthy) {
          this.recordSuccess(psp)
        } else {
          this.recordFailure(psp)
        }
      } catch {
        results.set(psp, { healthy: false, latency_ms: 0 })
        this.recordFailure(psp)
      }
    }

    return results
  }
}
