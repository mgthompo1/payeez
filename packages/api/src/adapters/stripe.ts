// ============================================
// Stripe PSP Adapter
// ============================================

import { BasePSPAdapter } from './base'
import type {
  PSPCredentials,
  PSPChargeRequest,
  PSPChargeResponse,
  PSPRefundRequest,
  PSPRefundResponse,
  PSPCaptureRequest,
  PSPCaptureResponse,
} from '../types'
import { createHmac, timingSafeEqual } from 'crypto'

export class StripeAdapter extends BasePSPAdapter {
  private apiVersion = '2024-12-18.acacia'

  constructor(credentials: PSPCredentials) {
    super('stripe', credentials)
  }

  protected getBaseUrl(): string {
    return 'https://api.stripe.com/v1'
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.credentials.api_key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': this.apiVersion,
    }
  }

  private encodeFormData(data: Record<string, unknown>, prefix = ''): string {
    const pairs: string[] = []

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue

      const encodedKey = prefix ? `${prefix}[${key}]` : key

      if (typeof value === 'object' && !Array.isArray(value)) {
        pairs.push(this.encodeFormData(value as Record<string, unknown>, encodedKey))
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            pairs.push(this.encodeFormData(item as Record<string, unknown>, `${encodedKey}[${index}]`))
          } else {
            pairs.push(`${encodedKey}[${index}]=${encodeURIComponent(String(item))}`)
          }
        })
      } else {
        pairs.push(`${encodedKey}=${encodeURIComponent(String(value))}`)
      }
    }

    return pairs.filter(Boolean).join('&')
  }

  async charge(request: PSPChargeRequest): Promise<PSPChargeResponse> {
    // Create PaymentIntent
    const params: Record<string, unknown> = {
      amount: request.amount,
      currency: request.currency.toLowerCase(),
      confirm: true,
      payment_method_data: {
        type: 'card',
        card: {
          token: request.token, // Basis Theory token passed through proxy
        },
      },
      capture_method: request.capture ? 'automatic' : 'manual',
      metadata: request.metadata || {},
    }

    if (request.customer_email) {
      params.receipt_email = request.customer_email
    }

    if (request.description) {
      params.description = request.description
    }

    // Add 3DS data if available
    if (request.threeds) {
      params.payment_method_options = {
        card: {
          three_d_secure: {
            cryptogram: request.threeds.cavv,
            electronic_commerce_indicator: request.threeds.eci,
            transaction_id: request.threeds.ds_transaction_id,
            version: request.threeds.version,
          },
        },
      }
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/payment_intents`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Idempotency-Key': request.idempotency_key,
        },
        body: this.encodeFormData(params),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        transaction_id: '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency,
        failure_code: data.error?.code || 'unknown_error',
        failure_message: data.error?.message || 'Payment failed',
        failure_category: this.normalizeFailureCategory(
          data.error?.code || '',
          data.error?.message || ''
        ),
        raw_response: data,
      }
    }

    // Handle requires_action (3DS challenge)
    if (data.status === 'requires_action') {
      return {
        success: false,
        transaction_id: data.id,
        status: 'pending',
        amount: request.amount,
        currency: request.currency,
        raw_response: data,
        requires_action: {
          type: '3ds_challenge',
          url: data.next_action?.redirect_to_url?.url || data.next_action?.use_stripe_sdk?.stripe_js,
        },
      }
    }

    const status = this.mapStripeStatus(data.status)

    return {
      success: status === 'authorized' || status === 'captured',
      transaction_id: data.id,
      status,
      amount: data.amount,
      currency: data.currency.toUpperCase(),
      raw_response: data,
    }
  }

  async capture(request: PSPCaptureRequest): Promise<PSPCaptureResponse> {
    const params: Record<string, unknown> = {}

    if (request.amount) {
      params.amount_to_capture = request.amount
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/payment_intents/${request.transaction_id}/capture`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: this.encodeFormData(params),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        transaction_id: request.transaction_id,
        amount: request.amount || 0,
        status: 'failed',
        failure_message: data.error?.message || 'Capture failed',
        raw_response: data,
      }
    }

    return {
      success: true,
      transaction_id: data.id,
      amount: data.amount_received,
      status: 'captured',
      raw_response: data,
    }
  }

  async refund(request: PSPRefundRequest): Promise<PSPRefundResponse> {
    const params: Record<string, unknown> = {
      payment_intent: request.transaction_id,
    }

    if (request.amount) {
      params.amount = request.amount
    }

    if (request.reason) {
      params.reason = request.reason
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/refunds`,
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Idempotency-Key': request.idempotency_key,
        },
        body: this.encodeFormData(params),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        refund_id: '',
        amount: request.amount || 0,
        status: 'failed',
        failure_message: data.error?.message || 'Refund failed',
        raw_response: data,
      }
    }

    return {
      success: true,
      refund_id: data.id,
      amount: data.amount,
      status: data.status === 'succeeded' ? 'succeeded' : 'pending',
      raw_response: data,
    }
  }

  async void(transactionId: string): Promise<{ success: boolean; error?: string }> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/payment_intents/${transactionId}/cancel`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Void failed',
      }
    }

    return { success: true }
  }

  async initiate3DS(request: {
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
  }> {
    // Create a PaymentIntent with requires_action
    const params = {
      amount: request.amount,
      currency: request.currency.toLowerCase(),
      payment_method_data: {
        type: 'card',
        card: {
          token: request.token,
        },
      },
      confirm: true,
      return_url: request.return_url,
      payment_method_options: {
        card: {
          request_three_d_secure: 'any',
        },
      },
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/payment_intents`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: this.encodeFormData(params),
      }
    )

    const data = await response.json()

    if (data.status === 'requires_action') {
      return {
        threeds_session_id: data.id,
        challenge_required: true,
        challenge_url: data.next_action?.redirect_to_url?.url,
      }
    }

    // 3DS not required or already authenticated
    return {
      threeds_session_id: data.id,
      challenge_required: false,
      authentication_value: data.payment_method_options?.card?.three_d_secure?.authentication_flow,
      eci: data.payment_method_options?.card?.three_d_secure?.electronic_commerce_indicator,
    }
  }

  verifyWebhook(payload: string, signature: string): boolean {
    if (!this.credentials.webhook_secret) {
      throw new Error('Webhook secret not configured')
    }

    const parts = signature.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
    const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1]

    if (!timestamp || !sig) {
      return false
    }

    // Check timestamp is within tolerance (5 minutes)
    const timestampAge = Date.now() / 1000 - parseInt(timestamp)
    if (timestampAge > 300) {
      return false
    }

    const signedPayload = `${timestamp}.${payload}`
    const expectedSig = createHmac('sha256', this.credentials.webhook_secret)
      .update(signedPayload)
      .digest('hex')

    try {
      return timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    } catch {
      return false
    }
  }

  parseWebhook(payload: string): {
    event_type: string
    transaction_id?: string
    amount?: number
    currency?: string
    raw: Record<string, unknown>
  } {
    const event = JSON.parse(payload)
    const object = event.data?.object || {}

    // Map Stripe event types to our normalized types
    const eventTypeMap: Record<string, string> = {
      'payment_intent.succeeded': 'payment.captured',
      'payment_intent.payment_failed': 'payment.failed',
      'payment_intent.canceled': 'payment.canceled',
      'payment_intent.requires_capture': 'payment.authorized',
      'charge.refunded': 'refund.succeeded',
      'charge.dispute.created': 'dispute.created',
      'charge.dispute.closed': object.status === 'won' ? 'dispute.won' : 'dispute.lost',
    }

    return {
      event_type: eventTypeMap[event.type] || event.type,
      transaction_id: object.id || object.payment_intent,
      amount: object.amount,
      currency: object.currency?.toUpperCase(),
      raw: event,
    }
  }

  protected async ping(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/balance`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error('Stripe health check failed')
    }
  }

  private mapStripeStatus(status: string): 'authorized' | 'captured' | 'failed' | 'pending' {
    switch (status) {
      case 'succeeded':
        return 'captured'
      case 'requires_capture':
        return 'authorized'
      case 'requires_action':
      case 'requires_payment_method':
      case 'processing':
        return 'pending'
      case 'canceled':
      default:
        return 'failed'
    }
  }
}
