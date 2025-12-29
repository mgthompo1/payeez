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
export type VaultProvider = 'basis_theory' | 'vgs';
export type Environment = 'test' | 'live';

// Payment method types supported
export type PaymentMethodType =
  | 'card'
  | 'apple_pay'
  | 'google_pay'
  | 'bank_account'; // ACH

export interface PaymentMethodConfig {
  card?: {
    enabled: boolean;
    brands?: string[]; // visa, mastercard, amex, etc.
  };
  apple_pay?: {
    enabled: boolean;
    merchant_id?: string;
    merchant_name?: string;
    supported_networks?: string[];
  };
  google_pay?: {
    enabled: boolean;
    merchant_id?: string;
    merchant_name?: string;
    environment?: 'TEST' | 'PRODUCTION';
  };
  bank_account?: {
    enabled: boolean;
    account_types?: ('checking' | 'savings')[];
  };
}

export type PaymentSessionStatus =
  | 'pending'
  | 'requires_payment_method'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded';

export type PaymentAttemptStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'canceled'
  | 'refunded';

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
  payment_method_types?: PaymentMethodType[]; // defaults to tenant config
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
  payment_method_type: PaymentMethodType;
  token_id?: string;
  token_provider: VaultProvider;
  psp?: string;
  routing_profile_id?: string;
  // Apple Pay specific
  apple_pay_token?: string; // PKPaymentToken from Apple
  // Google Pay specific
  google_pay_token?: string; // PaymentData from Google
  // VGS-specific data with field aliases
  vgs_data?: {
    card_number: string;
    card_expiry: string;
    card_cvc: string;
  };
  // Bank account specific
  bank_account?: {
    routing_number?: string; // tokenized
    account_number?: string; // tokenized
    account_type?: 'checking' | 'savings';
    account_holder_name?: string;
  };
}

export interface Payment {
  id: string;
  session_id: string;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  payment_method_type: PaymentMethodType;
  psp: PSPName;
  psp_transaction_id?: string;
  captured_amount?: number;
  refunded_amount?: number;
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  };
  wallet?: {
    type: 'apple_pay' | 'google_pay';
    card_network?: string;
  };
  bank_account?: {
    bank_name?: string;
    last4?: string;
    account_type?: 'checking' | 'savings';
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
  currency?: string;
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string;
  created_at: string;
}

// ============================================
// Webhook Types
// ============================================

export type WebhookEventType =
  | 'payment.authorized'
  | 'payment.captured'
  | 'payment.failed'
  | 'payment.canceled'
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

// ============================================
// Orchestration Types
// ============================================

export interface OrchestrationProfile {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  environment: Environment;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export interface TrafficSplitRule {
  id: string;
  profile_id: string;
  tenant_id: string;
  psp: PSPName;
  weight: number; // 0-100 percentage
  conditions?: RoutingConditions;
  priority: number;
  is_active: boolean;
}

export interface RetryRule {
  id: string;
  profile_id: string;
  tenant_id: string;
  source_psp: PSPName;
  target_psp: PSPName;
  retry_order: number; // 1-5
  failure_codes?: string[]; // null = any failure
  max_retries: number;
  retry_delay_ms: number;
  is_active: boolean;
}

export interface PSPPriority {
  id: string;
  profile_id: string;
  tenant_id: string;
  psp: PSPName;
  priority: number; // 1 = highest
  is_healthy: boolean;
  avg_latency_ms?: number;
  success_rate?: number;
  is_active: boolean;
}

export interface VaultConfig {
  id: string;
  tenant_id: string;
  environment: Environment;
  primary_vault: VaultProvider;
  bt_public_key?: string;
  vgs_vault_id?: string;
  vgs_environment?: 'sandbox' | 'live';
  failover_vault?: VaultProvider;
  is_active: boolean;
}

export interface RoutingDecision {
  id: string;
  tenant_id: string;
  session_id: string;
  selected_psp: PSPName;
  selection_reason: 'weighted_random' | 'retry' | 'failover' | 'condition_match';
  candidates: Array<{ psp: PSPName; weight: number }>;
  is_retry: boolean;
  retry_number?: number;
  previous_psp?: PSPName;
  previous_failure_code?: string;
  outcome?: 'pending' | 'success' | 'failure';
  created_at: string;
}

export interface RoutingConditions {
  currency?: string;
  amount_gte?: number;
  amount_lte?: number;
  card_brand?: string;
  country?: string;
  payment_method?: PaymentMethodType;
}

export interface PSPCredentials {
  psp: PSPName;
  environment: Environment;
  // Actual credential fields vary by PSP - stored encrypted
  [key: string]: unknown;
}

// Legacy RoutingRule for backwards compatibility
export interface RoutingRule {
  id: string;
  tenant_id: string;
  priority: number;
  conditions: RoutingConditions;
  psp: PSPName;
  weight: number;
  is_active: boolean;
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
  // Basis Theory configuration
  basis_theory_key?: string;
  bt_reactor_id?: string;
  // VGS configuration
  vgs_vault_id?: string;
  vgs_environment?: 'sandbox' | 'live';
  fallback_url?: string;
  // Payment methods available for this session
  payment_methods: PaymentMethodType[];
  // Apple Pay configuration (if enabled)
  apple_pay?: {
    merchant_id: string;
    merchant_name: string;
    country_code: string;
    supported_networks: string[];
  };
  // Google Pay configuration (if enabled)
  google_pay?: {
    merchant_id: string;
    merchant_name: string;
    environment: 'TEST' | 'PRODUCTION';
    allowed_card_networks: string[];
  };
  // Bank account configuration (if enabled)
  bank_account?: {
    account_types: ('checking' | 'savings')[];
  };
}
