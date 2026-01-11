/**
 * Standardized API Response Utilities
 *
 * Follows Stripe-style error schema for consistency:
 * - request_id: Unique identifier for debugging
 * - type: Error category (api_error, card_error, invalid_request_error, etc.)
 * - code: Specific error code
 * - decline_code: Card-specific decline reason (optional)
 * - message: Human-readable message
 * - param: Parameter that caused the error (optional)
 */

import { buildCorsHeaders } from './auth.ts';

// ============================================
// Request ID Generation
// ============================================

/**
 * Generate a unique request ID for tracing
 * Format: req_{timestamp}_{random}
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().split('-')[0];
  return `req_${timestamp}_${random}`;
}

// ============================================
// Error Types (Stripe-compatible)
// ============================================

export type ErrorType =
  | 'api_error'           // Internal server errors
  | 'authentication_error' // Invalid API key
  | 'card_error'          // Card was declined
  | 'idempotency_error'   // Idempotency key conflict
  | 'invalid_request_error' // Invalid parameters
  | 'rate_limit_error'    // Too many requests
  | 'validation_error';   // Request validation failed

export interface AtlasError {
  type: ErrorType;
  code: string;
  message: string;
  decline_code?: string;
  param?: string;
  request_id: string;
  doc_url?: string;
}

export interface AtlasErrorResponse {
  error: AtlasError;
}

// ============================================
// HTTP Status Code Mapping (Stripe-compatible)
// ============================================

/**
 * Get HTTP status code for error type
 * - 400: Invalid request
 * - 401: Authentication error
 * - 402: Card/payment error (Stripe convention)
 * - 409: Idempotency/conflict error
 * - 429: Rate limit
 * - 500: API error
 */
export function getStatusForErrorType(type: ErrorType, code?: string): number {
  switch (type) {
    case 'authentication_error':
      return 401;
    case 'card_error':
      return 402; // Stripe uses 402 for payment errors
    case 'idempotency_error':
      return 409;
    case 'rate_limit_error':
      return 429;
    case 'api_error':
      return 500;
    case 'invalid_request_error':
    case 'validation_error':
    default:
      // Use 409 for state conflicts
      if (code === 'session_already_processing' || code === 'session_already_completed') {
        return 409;
      }
      return 400;
  }
}

// ============================================
// Error Response Builder
// ============================================

interface ErrorOptions {
  type: ErrorType;
  code: string;
  message: string;
  decline_code?: string;
  param?: string;
  requestId?: string;
  corsOrigin?: string | null;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(options: ErrorOptions): Response {
  const requestId = options.requestId || generateRequestId();
  const status = getStatusForErrorType(options.type, options.code);

  const error: AtlasError = {
    type: options.type,
    code: options.code,
    message: options.message,
    request_id: requestId,
  };

  if (options.decline_code) {
    error.decline_code = options.decline_code;
  }

  if (options.param) {
    error.param = options.param;
  }

  // Add documentation URL for known error codes
  const docUrl = getDocUrlForCode(options.code);
  if (docUrl) {
    error.doc_url = docUrl;
  }

  const corsHeaders = buildCorsHeaders(options.corsOrigin ?? null);

  return new Response(
    JSON.stringify({ error }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      },
    }
  );
}

// ============================================
// Common Error Factories
// ============================================

/**
 * Invalid request error (400)
 */
export function invalidRequestError(
  message: string,
  code: string = 'invalid_request',
  param?: string,
  requestId?: string,
  corsOrigin?: string | null
): Response {
  return createErrorResponse({
    type: 'invalid_request_error',
    code,
    message,
    param,
    requestId,
    corsOrigin,
  });
}

/**
 * Authentication error (401)
 */
export function authenticationError(
  message: string = 'Invalid API key provided',
  code: string = 'invalid_api_key',
  requestId?: string,
  corsOrigin?: string | null
): Response {
  return createErrorResponse({
    type: 'authentication_error',
    code,
    message,
    requestId,
    corsOrigin,
  });
}

/**
 * Card/payment error (402)
 */
export function cardError(
  message: string,
  code: string,
  decline_code?: string,
  requestId?: string,
  corsOrigin?: string | null
): Response {
  return createErrorResponse({
    type: 'card_error',
    code,
    message,
    decline_code,
    requestId,
    corsOrigin,
  });
}

/**
 * Idempotency error (409)
 */
export function idempotencyError(
  message: string,
  code: string = 'idempotency_key_in_use',
  requestId?: string,
  corsOrigin?: string | null
): Response {
  return createErrorResponse({
    type: 'idempotency_error',
    code,
    message,
    requestId,
    corsOrigin,
  });
}

/**
 * API/server error (500)
 */
export function apiError(
  message: string = 'An unexpected error occurred',
  code: string = 'api_error',
  requestId?: string,
  corsOrigin?: string | null
): Response {
  return createErrorResponse({
    type: 'api_error',
    code,
    message,
    requestId,
    corsOrigin,
  });
}

// ============================================
// Success Response Builder
// ============================================

interface SuccessOptions {
  requestId?: string;
  corsOrigin?: string | null;
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse(
  data: unknown,
  status: number = 200,
  options: SuccessOptions = {}
): Response {
  const requestId = options.requestId || generateRequestId();
  const corsHeaders = buildCorsHeaders(options.corsOrigin ?? null);

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      },
    }
  );
}

// ============================================
// Payment-Specific Errors
// ============================================

/**
 * Map PSP failure codes to standardized decline codes
 */
export function mapToDeclineCode(pspCode?: string): string | undefined {
  if (!pspCode) return undefined;

  const codeMap: Record<string, string> = {
    // Generic declines
    'card_declined': 'generic_decline',
    'do_not_honor': 'do_not_honor',

    // Insufficient funds
    'insufficient_funds': 'insufficient_funds',
    'nsf': 'insufficient_funds',

    // Card issues
    'expired_card': 'expired_card',
    'invalid_card': 'invalid_number',
    'invalid_card_number': 'invalid_number',
    'invalid_cvc': 'invalid_cvc',
    'invalid_expiry': 'invalid_expiry_month',

    // Fraud
    'fraud_detected': 'fraudulent',
    'pickup_card': 'pickup_card',
    'lost_card': 'lost_card',
    'stolen_card': 'stolen_card',

    // Processing
    'processor_error': 'processing_error',
    'gateway_error': 'processing_error',
    'timeout': 'processing_error',

    // Limits
    'card_velocity_exceeded': 'card_velocity_exceeded',
    'amount_too_large': 'amount_too_large',
    'amount_too_small': 'amount_too_small',
  };

  return codeMap[pspCode.toLowerCase()] || pspCode;
}

/**
 * Create a payment failure response
 */
export function paymentFailedError(
  message: string,
  pspCode?: string,
  pspMessage?: string,
  requestId?: string,
  corsOrigin?: string | null
): Response {
  const declineCode = mapToDeclineCode(pspCode);
  const displayMessage = pspMessage || message || 'Your payment was declined.';

  return createErrorResponse({
    type: 'card_error',
    code: 'payment_failed',
    message: displayMessage,
    decline_code: declineCode,
    requestId,
    corsOrigin,
  });
}

// ============================================
// Documentation URLs
// ============================================

const DOC_BASE_URL = 'https://docs.atlas.io/errors';

function getDocUrlForCode(code: string): string | undefined {
  const documentedCodes = [
    'invalid_api_key',
    'invalid_request',
    'card_declined',
    'payment_failed',
    'session_expired',
    'idempotency_key_in_use',
  ];

  if (documentedCodes.includes(code)) {
    return `${DOC_BASE_URL}#${code}`;
  }

  return undefined;
}

// ============================================
// Request Context
// ============================================

/**
 * Extract request context for logging and responses
 */
export function getRequestContext(req: Request): {
  requestId: string;
  corsOrigin: string | null;
  idempotencyKey: string | null;
} {
  return {
    requestId: req.headers.get('x-request-id') || generateRequestId(),
    corsOrigin: req.headers.get('origin'),
    idempotencyKey: req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key'),
  };
}
