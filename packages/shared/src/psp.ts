import type { PSPName, PaymentAttemptStatus, WebhookEventType } from './types';

// ============================================
// PSP Adapter Interface
// ============================================

export interface AuthorizeRequest {
  amount: number; // cents
  currency: string;
  token: {
    id: string;
    provider: 'basis_theory';
  };
  idempotencyKey: string;
  capture: boolean; // auto-capture or auth-only
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface AuthorizeResponse {
  success: boolean;
  transactionId: string; // PSP's transaction/payment ID
  status: PaymentAttemptStatus;
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  };
  failureCode?: string;
  failureMessage?: string;
  rawResponse: unknown; // full PSP response for debugging
}

export interface CaptureRequest {
  transactionId: string;
  amount?: number; // for partial capture
}

export interface RefundRequest {
  transactionId: string;
  amount: number; // cents
  idempotencyKey: string;
  reason?: string;
}

export interface NormalizedWebhookEvent {
  type: WebhookEventType;
  pspEventId: string;
  transactionId: string;
  amount?: number;
  currency?: string;
  failureCode?: string;
  failureMessage?: string;
  payload: unknown;
}

// ============================================
// PSP Adapter Contract
// ============================================

export interface PSPAdapter {
  /** PSP identifier */
  name: PSPName;

  /**
   * Authorize (and optionally capture) a payment
   * Uses Basis Theory proxy to detokenize card data
   */
  authorize(
    req: AuthorizeRequest,
    credentials: Record<string, string>
  ): Promise<AuthorizeResponse>;

  /**
   * Capture a previously authorized payment
   */
  capture(
    req: CaptureRequest,
    credentials: Record<string, string>
  ): Promise<AuthorizeResponse>;

  /**
   * Refund a captured payment
   */
  refund(
    req: RefundRequest,
    credentials: Record<string, string>
  ): Promise<AuthorizeResponse>;

  /**
   * Verify webhook signature
   */
  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean;

  /**
   * Normalize PSP-specific webhook to common format
   */
  normalizeWebhook(payload: unknown): NormalizedWebhookEvent;
}

// ============================================
// Error Taxonomy
// ============================================

export type PaymentFailureCategory =
  | 'card_declined'
  | 'insufficient_funds'
  | 'expired_card'
  | 'invalid_card'
  | 'fraud_suspected'
  | 'processing_error'
  | 'authentication_required'
  | 'unknown';

export interface NormalizedError {
  category: PaymentFailureCategory;
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Map PSP-specific error codes to normalized categories
 * Each adapter should implement this for their error codes
 */
export function categorizeError(
  psp: PSPName,
  code: string,
  message: string
): NormalizedError {
  // Default implementation - adapters override with PSP-specific logic
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('insufficient funds')) {
    return {
      category: 'insufficient_funds',
      code,
      message,
      retryable: false,
    };
  }

  if (lowerMessage.includes('expired')) {
    return {
      category: 'expired_card',
      code,
      message,
      retryable: false,
    };
  }

  if (lowerMessage.includes('declined')) {
    return {
      category: 'card_declined',
      code,
      message,
      retryable: false,
    };
  }

  if (lowerMessage.includes('fraud')) {
    return {
      category: 'fraud_suspected',
      code,
      message,
      retryable: false,
    };
  }

  return {
    category: 'unknown',
    code,
    message,
    retryable: true,
  };
}
