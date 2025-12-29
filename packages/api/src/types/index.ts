// ============================================
// Core Types for Payment Orchestration
// ============================================

// PSP Types
export type PSPName = 'stripe' | 'adyen' | 'authorizenet' | 'chase' | 'nuvei' | 'dlocal' | 'braintree' | 'checkoutcom' | 'airwallex'

export type PaymentStatus = 'pending' | 'requires_action' | 'processing' | 'authorized' | 'captured' | 'failed' | 'canceled' | 'refunded'

export type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay' | 'bank_account'

export type VaultProvider = 'basis_theory' | 'vgs'

export type CaptureMethod = 'automatic' | 'manual'

export type ThreeDSStatus = 'not_required' | 'pending' | 'challenge_required' | 'authenticated' | 'failed'

// Card Types
export interface CardData {
  number: string
  exp_month: number
  exp_year: number
  cvc: string
  name?: string
}

export interface TokenizedCard {
  id: string
  brand: string
  last4: string
  exp_month: number
  exp_year: number
  fingerprint?: string
}

// Payment Session
export interface CreateSessionRequest {
  amount: number
  currency: string
  capture_method?: CaptureMethod
  customer_email?: string
  customer_name?: string
  metadata?: Record<string, string>
  success_url?: string
  cancel_url?: string
  external_id?: string
  require_3ds?: boolean
  allowed_psps?: PSPName[]
}

export interface PaymentSession {
  id: string
  client_secret: string
  amount: number
  currency: string
  status: PaymentStatus
  capture_method: CaptureMethod
  customer_email?: string
  customer_name?: string
  metadata: Record<string, string>
  success_url?: string
  cancel_url?: string
  external_id?: string
  threeds_status?: ThreeDSStatus
  created_at: string
  expires_at: string
}

// Payment Confirmation
export interface ConfirmPaymentRequestV2 {
  payment_method_type: PaymentMethodType
  token_id?: string
  token_provider: VaultProvider
  psp?: string
  routing_profile_id?: string
  apple_pay_token?: string
  google_pay_token?: string
  bank_account?: {
    account_holder_name?: string
    account_type?: 'checking' | 'savings'
  }
  vgs_data?: {
    card_number: string
    card_expiry: string
    card_cvc: string
  }
}

export interface LegacyConfirmPaymentRequest {
  payment_method: {
    type: 'card' | 'token'
    card?: CardData
    token_id?: string
  }
  return_url?: string
  idempotency_key?: string
}

export type ConfirmPaymentRequest = ConfirmPaymentRequestV2 | LegacyConfirmPaymentRequest

export interface PaymentResult {
  session_id: string
  status: PaymentStatus
  psp: PSPName
  psp_transaction_id?: string
  amount: number
  currency: string
  authorized_at?: string
  captured_at?: string
  failure_code?: string
  failure_message?: string
  next_action?: {
    type: 'redirect' | '3ds_challenge'
    url: string
  }
  receipt?: {
    card_brand: string
    card_last4: string
  }
}

// PSP Adapter Interface
export interface PSPCredentials {
  api_key?: string
  api_secret?: string
  merchant_id?: string
  public_key?: string
  webhook_secret?: string
  environment: 'test' | 'live'
  [key: string]: string | undefined
}

export interface PSPChargeRequest {
  amount: number
  currency: string
  token: string // Basis Theory token or network token
  capture: boolean
  idempotency_key: string
  metadata?: Record<string, string>
  customer_email?: string
  description?: string
  threeds?: {
    cavv: string
    eci: string
    ds_transaction_id: string
    version: string
  }
}

export interface PSPChargeResponse {
  success: boolean
  transaction_id: string
  status: 'authorized' | 'captured' | 'failed' | 'pending'
  amount: number
  currency: string
  failure_code?: string
  failure_message?: string
  failure_category?: FailureCategory
  raw_response: Record<string, unknown>
  requires_action?: {
    type: 'redirect' | '3ds_challenge'
    url: string
  }
}

export interface PSPRefundRequest {
  transaction_id: string
  amount?: number // Partial refund if specified
  reason?: string
  idempotency_key: string
}

export interface PSPRefundResponse {
  success: boolean
  refund_id: string
  amount: number
  status: 'pending' | 'succeeded' | 'failed'
  failure_message?: string
  raw_response: Record<string, unknown>
}

export interface PSPCaptureRequest {
  transaction_id: string
  amount?: number // Partial capture if specified
}

export interface PSPCaptureResponse {
  success: boolean
  transaction_id: string
  amount: number
  status: 'captured' | 'failed'
  failure_message?: string
  raw_response: Record<string, unknown>
}

// Failure Categories (normalized across PSPs)
export type FailureCategory =
  | 'card_declined'
  | 'insufficient_funds'
  | 'expired_card'
  | 'invalid_card'
  | 'invalid_cvc'
  | 'fraud_suspected'
  | 'processing_error'
  | 'rate_limit'
  | 'authentication_required'
  | 'unknown'

// Webhook Types
export interface NormalizedWebhookEvent {
  id: string
  type: WebhookEventType
  psp: PSPName
  psp_event_id: string
  session_id?: string
  transaction_id?: string
  amount?: number
  currency?: string
  timestamp: string
  raw_payload: Record<string, unknown>
}

export type WebhookEventType =
  | 'payment.authorized'
  | 'payment.captured'
  | 'payment.failed'
  | 'payment.canceled'
  | 'refund.created'
  | 'refund.succeeded'
  | 'refund.failed'
  | 'dispute.created'
  | 'dispute.won'
  | 'dispute.lost'

// API Response Types
export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: APIError
}

export interface APIError {
  code: string
  message: string
  param?: string
  details?: Record<string, unknown>
}

// Rate Limiting
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

// Audit Log
export interface AuditLogEntry {
  id: string
  tenant_id: string
  user_id?: string
  action: string
  resource_type: string
  resource_id: string
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, unknown>
  created_at: string
}
