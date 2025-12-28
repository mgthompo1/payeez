// ============================================
// Base PSP Adapter
// All PSP integrations extend this class
// ============================================

import type {
  PSPName,
  PSPCredentials,
  PSPChargeRequest,
  PSPChargeResponse,
  PSPRefundRequest,
  PSPRefundResponse,
  PSPCaptureRequest,
  PSPCaptureResponse,
  FailureCategory,
} from '../types'

export abstract class BasePSPAdapter {
  protected name: PSPName
  protected credentials: PSPCredentials
  protected baseUrl: string

  constructor(name: PSPName, credentials: PSPCredentials) {
    this.name = name
    this.credentials = credentials
    this.baseUrl = this.getBaseUrl()
  }

  protected abstract getBaseUrl(): string

  // Core payment operations
  abstract charge(request: PSPChargeRequest): Promise<PSPChargeResponse>
  abstract capture(request: PSPCaptureRequest): Promise<PSPCaptureResponse>
  abstract refund(request: PSPRefundRequest): Promise<PSPRefundResponse>
  abstract void(transactionId: string): Promise<{ success: boolean; error?: string }>

  // 3D Secure
  abstract initiate3DS(request: {
    amount: number
    currency: string
    token: string
    return_url: string
  }): Promise<{
    threeds_session_id: string
    challenge_required: boolean
    challenge_url?: string
    authentication_value?: string
    eci?: string
  }>

  // Webhook verification
  abstract verifyWebhook(payload: string, signature: string): boolean
  abstract parseWebhook(payload: string): {
    event_type: string
    transaction_id?: string
    amount?: number
    currency?: string
    raw: Record<string, unknown>
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now()
    try {
      await this.ping()
      return { healthy: true, latency_ms: Date.now() - start }
    } catch {
      return { healthy: false, latency_ms: Date.now() - start }
    }
  }

  protected abstract ping(): Promise<void>

  // Normalize error codes across PSPs
  protected normalizeFailureCategory(code: string, message: string): FailureCategory {
    const lowerMessage = message.toLowerCase()
    const lowerCode = code.toLowerCase()

    if (lowerMessage.includes('insufficient') || lowerCode.includes('insufficient')) {
      return 'insufficient_funds'
    }
    if (lowerMessage.includes('expired') || lowerCode.includes('expired')) {
      return 'expired_card'
    }
    if (lowerMessage.includes('cvc') || lowerMessage.includes('cvv') || lowerCode.includes('cvc')) {
      return 'invalid_cvc'
    }
    if (lowerMessage.includes('fraud') || lowerCode.includes('fraud')) {
      return 'fraud_suspected'
    }
    if (lowerMessage.includes('declined') || lowerCode.includes('declined')) {
      return 'card_declined'
    }
    if (lowerMessage.includes('invalid') && (lowerMessage.includes('card') || lowerMessage.includes('number'))) {
      return 'invalid_card'
    }
    if (lowerMessage.includes('rate') || lowerCode.includes('rate_limit')) {
      return 'rate_limit'
    }
    if (lowerMessage.includes('authentication') || lowerMessage.includes('3ds')) {
      return 'authentication_required'
    }
    if (lowerMessage.includes('processing') || lowerCode.includes('processing')) {
      return 'processing_error'
    }

    return 'unknown'
  }

  // Helper for making HTTP requests with retry
  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        })

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return response
        }

        // Retry on server errors (5xx)
        if (response.status >= 500) {
          lastError = new Error(`Server error: ${response.status}`)
          await this.delay(Math.pow(2, attempt) * 1000) // Exponential backoff
          continue
        }

        return response
      } catch (error) {
        lastError = error as Error
        if (attempt < maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000)
        }
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Generate idempotency key if not provided
  protected generateIdempotencyKey(): string {
    return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }
}

// Factory for creating PSP adapters
export type PSPAdapterFactory = (credentials: PSPCredentials) => BasePSPAdapter
