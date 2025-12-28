// ============================================
// Test/Sandbox PSP Adapter
// Simulates payment processing for development and testing
// ============================================

import { BasePSPAdapter, PSPCredentials } from './base'
import type {
  PSPChargeRequest,
  PSPChargeResponse,
  PSPCaptureRequest,
  PSPRefundRequest,
  ThreeDSInitRequest,
  ThreeDSInitResponse,
  WebhookEvent,
  WebhookEventType,
} from '../types'

/**
 * Test card numbers and their behaviors
 * Based on Stripe's test card patterns
 */
export const TEST_CARDS = {
  // Successful cards
  SUCCESS: {
    '4242424242424242': { brand: 'visa', outcome: 'success' },
    '4000056655665556': { brand: 'visa_debit', outcome: 'success' },
    '5555555555554444': { brand: 'mastercard', outcome: 'success' },
    '5200828282828210': { brand: 'mastercard_debit', outcome: 'success' },
    '378282246310005': { brand: 'amex', outcome: 'success' },
    '6011111111111117': { brand: 'discover', outcome: 'success' },
    '3056930009020004': { brand: 'diners', outcome: 'success' },
    '3566002020360505': { brand: 'jcb', outcome: 'success' },
    '6200000000000005': { brand: 'unionpay', outcome: 'success' },
  },

  // Decline cards
  DECLINE: {
    '4000000000000002': { brand: 'visa', outcome: 'card_declined', message: 'Your card was declined.' },
    '4000000000009995': { brand: 'visa', outcome: 'insufficient_funds', message: 'Your card has insufficient funds.' },
    '4000000000009987': { brand: 'visa', outcome: 'lost_card', message: 'Your card has been reported lost.' },
    '4000000000009979': { brand: 'visa', outcome: 'stolen_card', message: 'Your card has been reported stolen.' },
    '4000000000000069': { brand: 'visa', outcome: 'expired_card', message: 'Your card has expired.' },
    '4000000000000127': { brand: 'visa', outcome: 'incorrect_cvc', message: 'Your card\'s security code is incorrect.' },
    '4000000000000119': { brand: 'visa', outcome: 'processing_error', message: 'An error occurred while processing your card.' },
    '4242424242424241': { brand: 'visa', outcome: 'incorrect_number', message: 'Your card number is incorrect.' },
  },

  // 3DS cards
  THREEDS: {
    '4000000000003220': { brand: 'visa', outcome: '3ds_required', version: '2.1.0' },
    '4000000000003063': { brand: 'visa', outcome: '3ds_required', version: '2.2.0' },
    '4000002500003155': { brand: 'visa', outcome: '3ds_required_fail', version: '2.1.0' },
    '4000008260003178': { brand: 'visa', outcome: '3ds_required_challenge', version: '2.1.0' },
  },

  // Fraud cards
  FRAUD: {
    '4100000000000019': { brand: 'visa', outcome: 'highest_risk', message: 'This payment was flagged as high risk.' },
    '4000000000004954': { brand: 'visa', outcome: 'elevated_risk', message: 'This payment requires review.' },
  },

  // Dispute cards
  DISPUTE: {
    '4000000000000259': { brand: 'visa', outcome: 'dispute', message: 'Payment will be disputed.' },
    '4000000000001976': { brand: 'visa', outcome: 'dispute_fraud', message: 'Payment will be disputed as fraudulent.' },
  },

  // Special behavior cards
  SPECIAL: {
    '4000000000000341': { brand: 'visa', outcome: 'attach_fail', message: 'Attaching this card will fail.' },
    '4000000000000010': { brand: 'visa', outcome: 'address_fail', message: 'Address verification failed.' },
    '4000000000000028': { brand: 'visa', outcome: 'address_unavailable', message: 'Address verification unavailable.' },
    '4000000000000036': { brand: 'visa', outcome: 'zip_fail', message: 'ZIP code verification failed.' },
    '4000000000005126': { brand: 'visa', outcome: 'cvc_check_fail', message: 'CVC check failed.' },
  },
} as const

type CardOutcome = 'success' | 'card_declined' | 'insufficient_funds' | 'lost_card' |
  'stolen_card' | 'expired_card' | 'incorrect_cvc' | 'processing_error' | 'incorrect_number' |
  '3ds_required' | '3ds_required_fail' | '3ds_required_challenge' | 'highest_risk' |
  'elevated_risk' | 'dispute' | 'dispute_fraud' | 'attach_fail' | 'address_fail' |
  'address_unavailable' | 'zip_fail' | 'cvc_check_fail'

interface TestCardInfo {
  brand: string
  outcome: CardOutcome
  message?: string
  version?: string
}

/**
 * Get card info from test card number
 */
function getTestCardInfo(cardNumber: string): TestCardInfo | null {
  // Remove spaces and dashes
  const cleanNumber = cardNumber.replace(/[\s-]/g, '')

  // Check all card categories
  for (const category of Object.values(TEST_CARDS)) {
    if (cleanNumber in category) {
      return category[cleanNumber as keyof typeof category] as TestCardInfo
    }
  }

  // Default to success for any 4242... pattern
  if (cleanNumber.startsWith('4242')) {
    return { brand: 'visa', outcome: 'success' }
  }

  return null
}

/**
 * Generate a test transaction ID
 */
function generateTestId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `${prefix}_test_${timestamp}${random}`
}

/**
 * Simulate network delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class TestAdapter extends BasePSPAdapter {
  readonly name = 'test'

  // Track transactions for simulating captures, refunds, etc.
  private transactions = new Map<string, {
    amount: number
    currency: string
    status: 'authorized' | 'captured' | 'refunded' | 'voided'
    capturedAmount: number
    refundedAmount: number
    metadata?: Record<string, unknown>
  }>()

  constructor(credentials: PSPCredentials) {
    super(credentials)
  }

  async charge(request: PSPChargeRequest): Promise<PSPChargeResponse> {
    // Simulate network latency (50-150ms)
    await delay(50 + Math.random() * 100)

    const cardNumber = request.token.replace('tok_test_', '') || '4242424242424242'
    const cardInfo = getTestCardInfo(cardNumber)

    if (!cardInfo) {
      return {
        success: false,
        transactionId: generateTestId('pi'),
        status: 'failed',
        failureReason: 'Invalid card number',
        failureCategory: 'invalid_card',
        rawResponse: { error: 'invalid_card' },
      }
    }

    const transactionId = generateTestId('pi')

    // Handle different outcomes
    switch (cardInfo.outcome) {
      case 'success':
        this.transactions.set(transactionId, {
          amount: request.amount,
          currency: request.currency,
          status: request.capture === false ? 'authorized' : 'captured',
          capturedAmount: request.capture === false ? 0 : request.amount,
          refundedAmount: 0,
          metadata: request.metadata,
        })

        return {
          success: true,
          transactionId,
          status: request.capture === false ? 'authorized' : 'captured',
          rawResponse: {
            id: transactionId,
            object: 'payment_intent',
            amount: request.amount,
            currency: request.currency.toLowerCase(),
            status: request.capture === false ? 'requires_capture' : 'succeeded',
          },
        }

      case '3ds_required':
      case '3ds_required_challenge':
        return {
          success: true,
          transactionId,
          status: 'requires_action',
          requires3DS: true,
          threeDSData: {
            version: cardInfo.version || '2.1.0',
            serverTransactionId: generateTestId('txn'),
            acsUrl: 'https://test.3ds.payeez.com/acs',
            acsChallenge: cardInfo.outcome === '3ds_required_challenge',
          },
          rawResponse: {
            id: transactionId,
            status: 'requires_action',
            next_action: {
              type: 'use_stripe_sdk',
              redirect_to_url: {
                url: 'https://test.3ds.payeez.com/challenge',
              },
            },
          },
        }

      case '3ds_required_fail':
        return {
          success: false,
          transactionId,
          status: 'failed',
          failureReason: '3DS authentication failed',
          failureCategory: 'authentication_failed',
          rawResponse: {
            id: transactionId,
            status: 'requires_payment_method',
            last_payment_error: {
              code: 'card_declined',
              decline_code: 'authentication_failed',
              message: '3DS authentication failed',
            },
          },
        }

      case 'card_declined':
      case 'insufficient_funds':
      case 'lost_card':
      case 'stolen_card':
      case 'expired_card':
      case 'incorrect_cvc':
      case 'incorrect_number':
        return {
          success: false,
          transactionId,
          status: 'failed',
          failureReason: cardInfo.message || 'Card declined',
          failureCategory: this.mapOutcomeToCategory(cardInfo.outcome),
          rawResponse: {
            id: transactionId,
            status: 'requires_payment_method',
            last_payment_error: {
              code: 'card_declined',
              decline_code: cardInfo.outcome,
              message: cardInfo.message,
            },
          },
        }

      case 'processing_error':
        return {
          success: false,
          transactionId,
          status: 'failed',
          failureReason: cardInfo.message || 'Processing error',
          failureCategory: 'processing_error',
          rawResponse: {
            id: transactionId,
            status: 'requires_payment_method',
            last_payment_error: {
              code: 'processing_error',
              message: cardInfo.message,
            },
          },
        }

      case 'highest_risk':
      case 'elevated_risk':
        return {
          success: false,
          transactionId,
          status: 'failed',
          failureReason: cardInfo.message || 'Payment flagged as high risk',
          failureCategory: 'fraud',
          rawResponse: {
            id: transactionId,
            status: 'requires_payment_method',
            last_payment_error: {
              code: 'card_declined',
              decline_code: 'fraud',
              message: cardInfo.message,
            },
          },
        }

      default:
        // Default to success for unknown outcomes
        this.transactions.set(transactionId, {
          amount: request.amount,
          currency: request.currency,
          status: 'captured',
          capturedAmount: request.amount,
          refundedAmount: 0,
        })

        return {
          success: true,
          transactionId,
          status: 'captured',
          rawResponse: { id: transactionId, status: 'succeeded' },
        }
    }
  }

  async capture(request: PSPCaptureRequest): Promise<PSPChargeResponse> {
    await delay(30 + Math.random() * 50)

    const transaction = this.transactions.get(request.transactionId)

    if (!transaction) {
      return {
        success: false,
        transactionId: request.transactionId,
        status: 'failed',
        failureReason: 'Transaction not found',
        failureCategory: 'invalid_request',
        rawResponse: { error: 'not_found' },
      }
    }

    if (transaction.status !== 'authorized') {
      return {
        success: false,
        transactionId: request.transactionId,
        status: 'failed',
        failureReason: `Cannot capture transaction with status: ${transaction.status}`,
        failureCategory: 'invalid_request',
        rawResponse: { error: 'invalid_state' },
      }
    }

    const captureAmount = request.amount || transaction.amount

    if (captureAmount > transaction.amount) {
      return {
        success: false,
        transactionId: request.transactionId,
        status: 'failed',
        failureReason: 'Capture amount exceeds authorized amount',
        failureCategory: 'invalid_request',
        rawResponse: { error: 'amount_too_large' },
      }
    }

    transaction.status = 'captured'
    transaction.capturedAmount = captureAmount

    return {
      success: true,
      transactionId: request.transactionId,
      status: 'captured',
      rawResponse: {
        id: request.transactionId,
        status: 'succeeded',
        amount_captured: captureAmount,
      },
    }
  }

  async refund(request: PSPRefundRequest): Promise<PSPChargeResponse> {
    await delay(30 + Math.random() * 50)

    const transaction = this.transactions.get(request.transactionId)

    if (!transaction) {
      return {
        success: false,
        transactionId: request.transactionId,
        status: 'failed',
        failureReason: 'Transaction not found',
        failureCategory: 'invalid_request',
        rawResponse: { error: 'not_found' },
      }
    }

    if (transaction.status !== 'captured') {
      return {
        success: false,
        transactionId: request.transactionId,
        status: 'failed',
        failureReason: `Cannot refund transaction with status: ${transaction.status}`,
        failureCategory: 'invalid_request',
        rawResponse: { error: 'invalid_state' },
      }
    }

    const refundAmount = request.amount || transaction.capturedAmount
    const availableToRefund = transaction.capturedAmount - transaction.refundedAmount

    if (refundAmount > availableToRefund) {
      return {
        success: false,
        transactionId: request.transactionId,
        status: 'failed',
        failureReason: 'Refund amount exceeds available amount',
        failureCategory: 'invalid_request',
        rawResponse: { error: 'amount_too_large' },
      }
    }

    transaction.refundedAmount += refundAmount

    if (transaction.refundedAmount >= transaction.capturedAmount) {
      transaction.status = 'refunded'
    }

    const refundId = generateTestId('re')

    return {
      success: true,
      transactionId: refundId,
      status: 'refunded',
      rawResponse: {
        id: refundId,
        payment_intent: request.transactionId,
        amount: refundAmount,
        status: 'succeeded',
      },
    }
  }

  async void(transactionId: string): Promise<PSPChargeResponse> {
    await delay(30 + Math.random() * 50)

    const transaction = this.transactions.get(transactionId)

    if (!transaction) {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureReason: 'Transaction not found',
        failureCategory: 'invalid_request',
        rawResponse: { error: 'not_found' },
      }
    }

    if (transaction.status !== 'authorized') {
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureReason: `Cannot void transaction with status: ${transaction.status}`,
        failureCategory: 'invalid_request',
        rawResponse: { error: 'invalid_state' },
      }
    }

    transaction.status = 'voided'

    return {
      success: true,
      transactionId,
      status: 'voided',
      rawResponse: {
        id: transactionId,
        status: 'canceled',
      },
    }
  }

  async initiate3DS(request: ThreeDSInitRequest): Promise<ThreeDSInitResponse> {
    await delay(100 + Math.random() * 100)

    const serverTransactionId = generateTestId('txn')

    return {
      serverTransactionId,
      acsUrl: 'https://test.3ds.payeez.com/acs',
      creq: Buffer.from(JSON.stringify({
        threeDSServerTransID: serverTransactionId,
        acsTransID: generateTestId('acs'),
        messageType: 'CReq',
        messageVersion: request.version || '2.1.0',
        challengeWindowSize: '05',
      })).toString('base64'),
      version: request.version || '2.1.0',
    }
  }

  verifyWebhook(payload: string, signature: string): boolean {
    // In test mode, accept any webhook with signature starting with 'test_'
    return signature.startsWith('test_') || signature.startsWith('whsec_test_')
  }

  parseWebhook(payload: unknown): WebhookEvent {
    const body = payload as Record<string, unknown>

    return {
      type: (body.type as WebhookEventType) || 'payment.captured',
      pspEventId: (body.id as string) || generateTestId('evt'),
      transactionId: (body.data as Record<string, unknown>)?.transaction_id as string,
      amount: (body.data as Record<string, unknown>)?.amount as number,
      currency: (body.data as Record<string, unknown>)?.currency as string,
      timestamp: new Date().toISOString(),
      rawPayload: body,
    }
  }

  /**
   * Simulate a webhook event
   */
  async simulateWebhook(
    type: WebhookEventType,
    transactionId: string,
    data?: Record<string, unknown>
  ): Promise<WebhookEvent> {
    return {
      type,
      pspEventId: generateTestId('evt'),
      transactionId,
      amount: data?.amount as number,
      currency: data?.currency as string,
      timestamp: new Date().toISOString(),
      rawPayload: {
        id: generateTestId('evt'),
        type,
        data: {
          transaction_id: transactionId,
          ...data,
        },
      },
    }
  }

  private mapOutcomeToCategory(outcome: CardOutcome): string {
    const mapping: Record<string, string> = {
      card_declined: 'card_declined',
      insufficient_funds: 'insufficient_funds',
      lost_card: 'lost_stolen',
      stolen_card: 'lost_stolen',
      expired_card: 'expired_card',
      incorrect_cvc: 'invalid_card',
      incorrect_number: 'invalid_card',
      processing_error: 'processing_error',
    }
    return mapping[outcome] || 'unknown'
  }
}

/**
 * Check if API key is for test mode
 */
export function isTestMode(apiKey: string): boolean {
  return apiKey.startsWith('sk_test_') || apiKey.startsWith('pk_test_')
}

/**
 * Get test card numbers for documentation
 */
export function getTestCardNumbers(): Record<string, { number: string; description: string }[]> {
  return {
    success: [
      { number: '4242424242424242', description: 'Visa - Succeeds' },
      { number: '5555555555554444', description: 'Mastercard - Succeeds' },
      { number: '378282246310005', description: 'American Express - Succeeds' },
      { number: '6011111111111117', description: 'Discover - Succeeds' },
    ],
    decline: [
      { number: '4000000000000002', description: 'Generic decline' },
      { number: '4000000000009995', description: 'Insufficient funds' },
      { number: '4000000000009987', description: 'Lost card' },
      { number: '4000000000009979', description: 'Stolen card' },
      { number: '4000000000000069', description: 'Expired card' },
      { number: '4000000000000127', description: 'Incorrect CVC' },
    ],
    threeds: [
      { number: '4000000000003220', description: '3DS required - succeeds' },
      { number: '4000002500003155', description: '3DS required - fails' },
      { number: '4000008260003178', description: '3DS challenge required' },
    ],
    fraud: [
      { number: '4100000000000019', description: 'Blocked as high risk' },
      { number: '4000000000004954', description: 'Requires review' },
    ],
    dispute: [
      { number: '4000000000000259', description: 'Creates dispute' },
      { number: '4000000000001976', description: 'Creates fraud dispute' },
    ],
  }
}
