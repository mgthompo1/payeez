// ============================================
// Core Domain Types
// ============================================

export type PSPName =
  | 'stripe'
  | 'adyen'
  | 'authorizenet'
  | 'chase'
  | 'nuvei'
  | 'dlocal'
  | 'braintree'
  | 'checkoutcom'
  | 'airwallex';
export type VaultProvider = 'basis_theory'; // Add 'vgs' later for redundancy
export type Environment = 'test' | 'live';

export type PaymentSessionStatus =
  | 'pending'
  | 'requires_payment_method'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type PaymentAttemptStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'canceled';

export type CaptureMethod = 'automatic' | 'manual';

export type MembershipRole = 'owner' | 'admin' | 'member';

// ============================================
// API Request/Response Types
// ============================================

export interface CreatePaymentSessionRequest {
  amount: number; // cents
  currency: string;
  external_id?: string; // merchant's order ID
  customer?: {
    email?: string;
    name?: string;
  };
  capture_method?: CaptureMethod;
  success_url?: string;
  cancel_url?: string;
  metadata?: Record<string, string>;
}

export interface PaymentSession {
  id: string;
  client_secret: string;
  status: PaymentSessionStatus;
  amount: number;
  currency: string;
  external_id?: string;
  fallback_url?: string; // PSP hosted checkout URL for break-glass
  created_at: string;
}

export interface ConfirmPaymentRequest {
  token_id: string;
  token_provider: VaultProvider;
}

export interface Payment {
  id: string;
  session_id: string;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  psp: PSPName;
  psp_transaction_id?: string;
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  };
  failure_code?: string;
  failure_message?: string;
  created_at: string;
}

export interface RefundRequest {
  payment_id: string;
  amount?: number; // partial refund in cents, full if omitted
  reason?: string;
}

export interface Refund {
  id: string;
  payment_id: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string;
  created_at: string;
}

// ============================================
// Webhook Types
// ============================================

export type WebhookEventType =
  | 'payment.authorized'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'refund.succeeded'
  | 'refund.failed';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: {
    payment_id?: string;
    session_id?: string;
    amount?: number;
    currency?: string;
    psp?: PSPName;
  };
  created_at: string;
}

// ============================================
// SDK Types (for frontend)
// ============================================

export interface PayeezConfig {
  sessionId: string;
  clientSecret: string;
  elementId: string;
  appearance?: PayeezAppearance;
  onSuccess?: (payment: Payment) => void;
  onError?: (error: PayeezError) => void;
  onReady?: () => void;
}

export interface PayeezAppearance {
  theme?: 'light' | 'dark';
  variables?: {
    colorPrimary?: string;
    colorBackground?: string;
    colorText?: string;
    borderRadius?: string;
    fontFamily?: string;
  };
}

export interface PayeezError {
  code: string;
  message: string;
  decline_code?: string;
}

// ============================================
// Internal/Admin Types
// ============================================

export interface RoutingRule {
  id: string;
  tenant_id: string;
  priority: number;
  conditions: RoutingConditions;
  psp: PSPName;
  weight: number; // for load balancing (0-100)
  is_active: boolean;
}

export interface RoutingConditions {
  currency?: string;
  amount_gte?: number;
  amount_lte?: number;
  card_brand?: string;
  country?: string;
}

export interface PSPCredentials {
  psp: PSPName;
  environment: Environment;
  // Actual credential fields vary by PSP - stored encrypted
  [key: string]: unknown;
}

// ============================================
// Session Config (returned to SDK)
// ============================================

export interface SessionConfig {
  session_id: string;
  client_secret: string;
  amount: number;
  currency: string;
  capture_provider: VaultProvider;
  basis_theory_key?: string; // public key for Basis Theory Elements
  fallback_url?: string;
}
