// ============================================
// Adyen PSP Adapter
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
import { createHmac } from 'crypto'

export class AdyenAdapter extends BasePSPAdapter {
  private merchantAccount: string

  constructor(credentials: PSPCredentials) {
    super('adyen', credentials)
    this.merchantAccount = credentials.merchant_id || ''
  }

  protected getBaseUrl(): string {
    const isLive = this.credentials.environment === 'live'
    const prefix = isLive ? (this.credentials.api_key?.substring(0, 8) || '') : ''
    return isLive
      ? `https://${prefix}-checkout-live.adyenpayments.com/checkout/v71`
      : 'https://checkout-test.adyen.com/v71'
  }

  private getHeaders(): HeadersInit {
    return {
      'X-API-Key': this.credentials.api_key || '',
      'Content-Type': 'application/json',
    }
  }

  async charge(request: PSPChargeRequest): Promise<PSPChargeResponse> {
    const payload = {
      merchantAccount: this.merchantAccount,
      amount: {
        value: request.amount,
        currency: request.currency.toUpperCase(),
      },
      reference: request.idempotency_key,
      paymentMethod: {
        type: 'scheme',
        storedPaymentMethodId: request.token, // Token from Basis Theory
      },
      shopperEmail: request.customer_email,
      shopperInteraction: 'ContAuth',
      recurringProcessingModel: 'CardOnFile',
      captureDelayHours: request.capture ? 0 : undefined,
      metadata: request.metadata,
    }

    // Add 3DS data if available
    if (request.threeds) {
      Object.assign(payload, {
        mpiData: {
          cavv: request.threeds.cavv,
          eci: request.threeds.eci,
          dsTransID: request.threeds.ds_transaction_id,
          threeDSVersion: request.threeds.version,
        },
      })
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/payments`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (!response.ok || data.resultCode === 'Error') {
      return {
        success: false,
        transaction_id: data.pspReference || '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency,
        failure_code: data.refusalReasonCode || data.errorCode || 'unknown',
        failure_message: data.refusalReason || data.message || 'Payment failed',
        failure_category: this.normalizeAdyenError(data.refusalReasonCode || ''),
        raw_response: data,
      }
    }

    // Handle redirect (3DS challenge)
    if (data.resultCode === 'RedirectShopper' || data.resultCode === 'ChallengeShopper') {
      return {
        success: false,
        transaction_id: data.pspReference,
        status: 'pending',
        amount: request.amount,
        currency: request.currency,
        raw_response: data,
        requires_action: {
          type: '3ds_challenge',
          url: data.action?.url || data.redirect?.url,
        },
      }
    }

    const status = this.mapAdyenStatus(data.resultCode)

    return {
      success: status === 'authorized' || status === 'captured',
      transaction_id: data.pspReference,
      status,
      amount: request.amount,
      currency: request.currency,
      raw_response: data,
    }
  }

  async capture(request: PSPCaptureRequest): Promise<PSPCaptureResponse> {
    const payload = {
      merchantAccount: this.merchantAccount,
      modificationAmount: request.amount ? {
        value: request.amount,
        currency: 'USD', // Would need to pass currency
      } : undefined,
      originalReference: request.transaction_id,
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/payments/${request.transaction_id}/captures`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (!response.ok || data.status === 'Error') {
      return {
        success: false,
        transaction_id: request.transaction_id,
        amount: request.amount || 0,
        status: 'failed',
        failure_message: data.message || 'Capture failed',
        raw_response: data,
      }
    }

    return {
      success: true,
      transaction_id: data.pspReference,
      amount: data.amount?.value || request.amount || 0,
      status: 'captured',
      raw_response: data,
    }
  }

  async refund(request: PSPRefundRequest): Promise<PSPRefundResponse> {
    const payload = {
      merchantAccount: this.merchantAccount,
      amount: request.amount ? {
        value: request.amount,
        currency: 'USD', // Would need to pass currency
      } : undefined,
      reference: request.idempotency_key,
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/payments/${request.transaction_id}/refunds`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (!response.ok || data.status === 'Error') {
      return {
        success: false,
        refund_id: '',
        amount: request.amount || 0,
        status: 'failed',
        failure_message: data.message || 'Refund failed',
        raw_response: data,
      }
    }

    return {
      success: true,
      refund_id: data.pspReference,
      amount: data.amount?.value || request.amount || 0,
      status: data.status === 'received' ? 'pending' : 'succeeded',
      raw_response: data,
    }
  }

  async void(transactionId: string): Promise<{ success: boolean; error?: string }> {
    const payload = {
      merchantAccount: this.merchantAccount,
      originalReference: transactionId,
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/payments/${transactionId}/cancels`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (!response.ok || data.status === 'Error') {
      return {
        success: false,
        error: data.message || 'Void failed',
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
    const payload = {
      merchantAccount: this.merchantAccount,
      amount: {
        value: request.amount,
        currency: request.currency.toUpperCase(),
      },
      reference: this.generateIdempotencyKey(),
      paymentMethod: {
        type: 'scheme',
        storedPaymentMethodId: request.token,
      },
      returnUrl: request.return_url,
      authenticationData: {
        attemptAuthentication: 'always',
      },
      channel: 'Web',
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/payments`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (data.resultCode === 'ChallengeShopper' || data.resultCode === 'RedirectShopper') {
      return {
        threeds_session_id: data.pspReference,
        challenge_required: true,
        challenge_url: data.action?.url || data.redirect?.url,
      }
    }

    return {
      threeds_session_id: data.pspReference,
      challenge_required: false,
      authentication_value: data.authentication?.['3ds2']?.authenticationValue,
      eci: data.authentication?.['3ds2']?.eci,
    }
  }

  verifyWebhook(payload: string, signature: string): boolean {
    if (!this.credentials.webhook_secret) {
      throw new Error('Webhook HMAC key not configured')
    }

    const expectedSignature = createHmac('sha256', Buffer.from(this.credentials.webhook_secret, 'hex'))
      .update(payload)
      .digest('base64')

    return signature === expectedSignature
  }

  parseWebhook(payload: string): {
    event_type: string
    transaction_id?: string
    amount?: number
    currency?: string
    raw: Record<string, unknown>
  } {
    const notification = JSON.parse(payload)
    const item = notification.notificationItems?.[0]?.NotificationRequestItem || notification

    // Map Adyen event codes to our normalized types
    const eventTypeMap: Record<string, string> = {
      'AUTHORISATION': item.success === 'true' ? 'payment.authorized' : 'payment.failed',
      'CAPTURE': 'payment.captured',
      'CANCELLATION': 'payment.canceled',
      'REFUND': 'refund.succeeded',
      'REFUND_FAILED': 'refund.failed',
      'CHARGEBACK': 'dispute.created',
      'CHARGEBACK_REVERSED': 'dispute.won',
    }

    return {
      event_type: eventTypeMap[item.eventCode] || item.eventCode,
      transaction_id: item.pspReference,
      amount: item.amount?.value,
      currency: item.amount?.currency,
      raw: notification,
    }
  }

  protected async ping(): Promise<void> {
    // Adyen doesn't have a simple ping endpoint, so we'll check the merchants endpoint
    const response = await fetch(
      `${this.getBaseUrl().replace('/checkout/v71', '')}/management/v3/merchants`,
      {
        headers: this.getHeaders(),
      }
    )

    if (!response.ok && response.status !== 401) {
      throw new Error('Adyen health check failed')
    }
  }

  private mapAdyenStatus(resultCode: string): 'authorized' | 'captured' | 'failed' | 'pending' {
    switch (resultCode) {
      case 'Authorised':
        return 'authorized'
      case 'Captured':
        return 'captured'
      case 'Pending':
      case 'Received':
      case 'RedirectShopper':
      case 'ChallengeShopper':
        return 'pending'
      case 'Refused':
      case 'Cancelled':
      case 'Error':
      default:
        return 'failed'
    }
  }

  private normalizeAdyenError(code: string): import('../types').FailureCategory {
    const codeMap: Record<string, import('../types').FailureCategory> = {
      '2': 'card_declined',
      '3': 'card_declined',
      '4': 'card_declined',
      '5': 'card_declined',
      '6': 'expired_card',
      '7': 'invalid_card',
      '8': 'invalid_card',
      '14': 'fraud_suspected',
      '15': 'invalid_cvc',
      '20': 'fraud_suspected',
    }

    return codeMap[code] || this.normalizeFailureCategory(code, '')
  }
}
