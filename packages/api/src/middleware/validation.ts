// ============================================
// Input Validation Schemas (Zod)
// ============================================

import { z } from 'zod'

// Currency codes (ISO 4217)
const currencySchema = z.string().length(3).toUpperCase()

// Amount in smallest unit (cents)
const amountSchema = z.number().int().positive().max(99999999)

// Card data
export const cardSchema = z.object({
  number: z.string().regex(/^\d{13,19}$/, 'Invalid card number'),
  exp_month: z.number().int().min(1).max(12),
  exp_year: z.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 20),
  cvc: z.string().regex(/^\d{3,4}$/, 'Invalid CVC'),
  name: z.string().max(100).optional(),
})

// Payment method
export const paymentMethodSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('card'),
    card: cardSchema,
  }),
  z.object({
    type: z.literal('token'),
    token_id: z.string().min(1),
  }),
])

const paymentMethodTypeSchema = z.enum(['card', 'apple_pay', 'google_pay', 'bank_account'])
const tokenProviderSchema = z.enum(['basis_theory', 'vgs'])
const bankAccountSchema = z.object({
  account_holder_name: z.string().max(200).optional(),
  account_type: z.enum(['checking', 'savings']).optional(),
}).optional()
const vgsDataSchema = z.object({
  card_number: z.string().min(1),
  card_expiry: z.string().min(1),
  card_cvc: z.string().min(1),
}).optional()

// Create session request
export const createSessionSchema = z.object({
  amount: amountSchema,
  currency: currencySchema,
  capture_method: z.enum(['automatic', 'manual']).default('automatic'),
  customer_email: z.string().email().optional(),
  customer_name: z.string().max(200).optional(),
  metadata: z.record(z.string()).optional(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
  external_id: z.string().max(100).optional(),
  require_3ds: z.boolean().optional(),
  allowed_psps: z.array(z.enum([
  'stripe', 'adyen', 'authorizenet', 'chase', 'nuvei',
  'dlocal', 'braintree', 'checkoutcom', 'airwallex'
  ])).optional(),
})

// Confirm payment request
const confirmPaymentSchemaV2 = z.object({
  payment_method_type: paymentMethodTypeSchema,
  token_id: z.string().min(1).optional(),
  token_provider: tokenProviderSchema,
  psp: z.string().min(1).optional(),
  routing_profile_id: z.string().uuid().optional(),
  apple_pay_token: z.string().min(1).optional(),
  google_pay_token: z.string().min(1).optional(),
  bank_account: bankAccountSchema,
  vgs_data: vgsDataSchema,
}).superRefine((data, ctx) => {
  if ((data.payment_method_type === 'card' || data.payment_method_type === 'bank_account') && !data.token_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['token_id'],
      message: 'token_id is required for card and bank account payments',
    })
  }

  if (data.payment_method_type === 'apple_pay' && !data.apple_pay_token) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['apple_pay_token'],
      message: 'apple_pay_token is required for Apple Pay',
    })
  }

  if (data.payment_method_type === 'google_pay' && !data.google_pay_token) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['google_pay_token'],
      message: 'google_pay_token is required for Google Pay',
    })
  }

  if (data.token_provider === 'vgs' && !data.vgs_data) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['vgs_data'],
      message: 'vgs_data is required when token_provider is vgs',
    })
  }
})

const legacyConfirmPaymentSchema = z.object({
  payment_method: paymentMethodSchema,
  return_url: z.string().url().optional(),
  idempotency_key: z.string().max(100).optional(),
})

export const confirmPaymentSchema = z.union([
  confirmPaymentSchemaV2,
  legacyConfirmPaymentSchema,
])

// Capture request
export const captureSchema = z.object({
  amount: amountSchema.optional(), // Partial capture
})

// Refund request
export const refundSchema = z.object({
  amount: amountSchema.optional(), // Partial refund
  reason: z.string().max(500).optional(),
  idempotency_key: z.string().max(100).optional(),
})

// Tokenize card request
export const tokenizeCardSchema = z.object({
  card: cardSchema,
  customer_email: z.string().email().optional(),
})

// PSP credentials
export const pspCredentialsSchema = z.object({
  psp: z.enum([
  'stripe', 'adyen', 'authorizenet', 'chase', 'nuvei',
  'dlocal', 'braintree', 'checkoutcom', 'airwallex'
  ]),
  environment: z.enum(['test', 'live']),
  api_key: z.string().min(1).optional(),
  api_secret: z.string().min(1).optional(),
  merchant_id: z.string().min(1).optional(),
  public_key: z.string().min(1).optional(),
  webhook_secret: z.string().min(1).optional(),
})

// Webhook endpoint
export const webhookEndpointSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'payment.authorized', 'payment.captured', 'payment.failed', 'payment.canceled',
    'refund.created', 'refund.succeeded', 'refund.failed',
    'dispute.created', 'dispute.won', 'dispute.lost'
  ])),
  enabled: z.boolean().default(true),
})

// Routing rule
export const routingRuleSchema = z.object({
  psp: z.enum([
  'stripe', 'adyen', 'authorizenet', 'chase', 'nuvei',
  'dlocal', 'braintree', 'checkoutcom', 'airwallex'
  ]),
  weight: z.number().int().min(0).max(100),
  conditions: z.object({
    currencies: z.array(currencySchema).optional(),
    amount_gte: amountSchema.optional(),
    amount_lte: amountSchema.optional(),
    card_brands: z.array(z.enum([
      'visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unionpay'
    ])).optional(),
  }).optional(),
  is_active: z.boolean().default(true),
})

// API Key
export const createApiKeySchema = z.object({
  label: z.string().min(1).max(100),
  environment: z.enum(['test', 'live']),
})

/**
 * Validation helper function
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true
  data: T
} | {
  success: false
  errors: Array<{ path: string; message: string }>
} {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
  }))

  return { success: false, errors }
}

/**
 * Format validation errors for API response
 */
export function formatValidationError(errors: Array<{ path: string; message: string }>): {
  code: string
  message: string
  details: Array<{ field: string; message: string }>
} {
  return {
    code: 'validation_error',
    message: 'Request validation failed',
    details: errors.map(e => ({
      field: e.path,
      message: e.message,
    })),
  }
}

// Type exports
export type CreateSessionRequest = z.infer<typeof createSessionSchema>
export type ConfirmPaymentRequest = z.infer<typeof confirmPaymentSchema>
export type CaptureRequest = z.infer<typeof captureSchema>
export type RefundRequest = z.infer<typeof refundSchema>
export type TokenizeCardRequest = z.infer<typeof tokenizeCardSchema>
export type PSPCredentialsRequest = z.infer<typeof pspCredentialsSchema>
export type WebhookEndpointRequest = z.infer<typeof webhookEndpointSchema>
export type RoutingRuleRequest = z.infer<typeof routingRuleSchema>
export type CreateApiKeyRequest = z.infer<typeof createApiKeySchema>
