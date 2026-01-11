/**
 * Stripe ACH Adapter
 *
 * Uses modern Stripe APIs:
 * - PaymentIntents with us_bank_account for debits
 * - Financial Connections for instant verification
 * - SetupIntents for storing payment methods
 *
 * NOT using deprecated:
 * - Charges API with bank_account tokens
 * - Legacy source tokens
 */

import type {
  ACHAdapter,
  ACHSettlementRequest,
  ACHSettlementResponse,
  ACHAttemptStatus,
  ACHVerificationResponse,
  ACHBankAccount,
  VerificationMethod,
} from './types.ts';

const STRIPE_API_VERSION = '2023-10-16';

interface StripeCredentials {
  secret_key: string;
  publishable_key?: string;
  webhook_secret?: string;
}

/**
 * Make authenticated request to Stripe API
 */
async function stripeRequest(
  endpoint: string,
  credentials: StripeCredentials,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  } = {}
): Promise<unknown> {
  const url = `https://api.stripe.com/v1${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${credentials.secret_key}`,
    'Stripe-Version': STRIPE_API_VERSION,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  // Convert nested object to Stripe's form-encoded format
  const formBody = options.body ? encodeStripeBody(options.body) : '';

  const response = await fetch(url, {
    method: options.method || 'POST',
    headers,
    body: options.method === 'GET' ? undefined : formBody,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Stripe API error: ${response.status}`);
  }

  return data;
}

/**
 * Encode object to Stripe's form-encoded format
 * Handles nested objects: { payment_method_data: { type: 'us_bank_account' } }
 * becomes: payment_method_data[type]=us_bank_account
 */
function encodeStripeBody(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;

    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(encodeStripeBody(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object') {
          parts.push(encodeStripeBody(item as Record<string, unknown>, `${fullKey}[${index}]`));
        } else {
          parts.push(`${fullKey}[${index}]=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${fullKey}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.filter(Boolean).join('&');
}

/**
 * Map Stripe PaymentIntent status to ACH status
 */
function mapStripeStatus(stripeStatus: string): ACHAttemptStatus {
  switch (stripeStatus) {
    case 'succeeded':
      return 'settled';
    case 'processing':
      return 'processing';
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_payment_method':
      return 'pending';
    case 'canceled':
      return 'canceled';
    default:
      return 'failed';
  }
}

/**
 * Calculate estimated settlement date for ACH
 * Standard ACH: 3-5 business days
 * Same-day ACH: Same business day (if before cutoff)
 */
function calculateEstimatedSettlement(sameDayEligible = false): string {
  const now = new Date();
  let daysToAdd = sameDayEligible ? 0 : 4; // Standard ACH ~4 business days

  // Skip weekends
  let date = new Date(now);
  while (daysToAdd > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      daysToAdd--;
    }
  }

  return date.toISOString();
}

/**
 * Stripe ACH Adapter
 */
export const stripeACHAdapter: ACHAdapter = {
  name: 'stripe_ach',

  async debit(req: ACHSettlementRequest, credentials: Record<string, string>): Promise<ACHSettlementResponse> {
    try {
      const creds = credentials as unknown as StripeCredentials;

      // Build mandate data for NACHA compliance
      const mandateData = req.mandate ? {
        customer_acceptance: {
          type: 'offline',
          accepted_at: Math.floor(new Date(req.mandate.acceptedAt).getTime() / 1000),
          offline: {
            contact_email: undefined, // Could add customer email here
          },
        },
      } : undefined;

      // Build payment intent body - prefer stored payment method if available
      const body: Record<string, unknown> = {
        amount: req.amount,
        currency: req.currency.toLowerCase(),
        payment_method_types: ['us_bank_account'],
        mandate_data: mandateData,
        confirm: true,
        statement_descriptor: req.statementDescriptor?.slice(0, 22),
        metadata: {
          atlas_transfer_id: req.transferId,
          ...(req.metadata || {}),
        },
      };

      // Use stored payment method ID (from verified SetupIntent) if available
      // This preserves verification state and is the recommended approach
      if (req.providerPaymentMethodId) {
        body.payment_method = req.providerPaymentMethodId;
      } else {
        // Fall back to creating payment method from raw data
        // This works but loses provider verification linkage
        body.payment_method_data = {
          type: 'us_bank_account',
          us_bank_account: {
            account_holder_type: req.bankAccount.accountHolderType,
            account_type: req.bankAccount.accountType,
            routing_number: req.bankAccount.routingNumber,
            account_number: req.bankAccount.accountNumber,
          },
          billing_details: {
            name: req.bankAccount.accountHolderName,
          },
        };
      }

      // Create PaymentIntent with us_bank_account
      const paymentIntent = await stripeRequest('/payment_intents', creds, {
        method: 'POST',
        idempotencyKey: req.idempotencyKey,
        body,
      }) as {
        id: string;
        status: string;
        next_action?: { type: string };
        last_payment_error?: { message: string; code: string };
      };

      const status = mapStripeStatus(paymentIntent.status);

      return {
        success: status === 'processing' || status === 'settled',
        status,
        providerId: paymentIntent.id,
        estimatedSettlementAt: calculateEstimatedSettlement(),
        failureCode: paymentIntent.last_payment_error?.code,
        failureMessage: paymentIntent.last_payment_error?.message,
        failureCategory: paymentIntent.last_payment_error ? 'provider_error' : undefined,
        rawResponse: paymentIntent,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        status: 'failed',
        providerId: '',
        failureCode: 'stripe_error',
        failureMessage: err.message,
        failureCategory: 'provider_error',
        rawResponse: { error: err.message },
      };
    }
  },

  async credit(req: ACHSettlementRequest, credentials: Record<string, string>): Promise<ACHSettlementResponse> {
    try {
      const creds = credentials as unknown as StripeCredentials;

      // For credits/payouts, we need to use different approaches based on account type:
      // 1. Stripe Connect: Create payout to connected account's external account
      // 2. Stripe Treasury: Create outbound transfer
      // 3. Standard account: Can't push to arbitrary external accounts directly

      // This implementation uses the Transfer API which requires Connect
      // For standard accounts, you'd need to use a different provider or Treasury

      // First, try to find or create a Stripe Customer for tracking
      // Then create an external account and payout

      // Note: Direct payouts to arbitrary external bank accounts requires
      // Stripe Connect Custom or Express accounts, or Stripe Treasury

      // For now, we'll document this limitation and return an error
      // suggesting the proper setup

      // Check if we have a connected_account_id in credentials (Connect flow)
      if (credentials.connected_account_id) {
        // Create payout via Connect
        const payout = await stripeRequest('/payouts', creds, {
          method: 'POST',
          idempotencyKey: req.idempotencyKey,
          body: {
            amount: req.amount,
            currency: req.currency.toLowerCase(),
            destination: credentials.external_account_id, // Pre-created external account
            statement_descriptor: req.statementDescriptor?.slice(0, 22),
            metadata: {
              atlas_transfer_id: req.transferId,
              ...(req.metadata || {}),
            },
          },
        }) as { id: string; status: string };

        return {
          success: payout.status === 'paid' || payout.status === 'pending',
          status: payout.status === 'paid' ? 'settled' : 'processing',
          providerId: payout.id,
          estimatedSettlementAt: calculateEstimatedSettlement(),
          rawResponse: payout,
        };
      }

      // Standard account without Connect - need to use different approach
      return {
        success: false,
        status: 'failed',
        providerId: '',
        failureCode: 'credit_not_supported',
        failureMessage: 'ACH credits require Stripe Connect or Treasury. Configure a connected_account_id in credentials.',
        failureCategory: 'validation_error',
        rawResponse: { error: 'Credits require Stripe Connect or Treasury API' },
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        status: 'failed',
        providerId: '',
        failureCode: 'stripe_error',
        failureMessage: err.message,
        failureCategory: 'provider_error',
        rawResponse: { error: err.message },
      };
    }
  },

  async initiateVerification(
    bankAccount: ACHBankAccount,
    credentials: Record<string, string>,
    options?: {
      preferredMethod?: VerificationMethod;
      redirectUrl?: string;
    }
  ): Promise<ACHVerificationResponse> {
    try {
      const creds = credentials as unknown as StripeCredentials;

      // Prefer Financial Connections for instant verification
      if (options?.preferredMethod === 'financial_connections' || !options?.preferredMethod) {
        try {
          // Create Financial Connections Session
          const session = await stripeRequest('/financial_connections/sessions', creds, {
            method: 'POST',
            body: {
              account_holder: {
                type: 'customer',
                // Would need customer ID here
              },
              permissions: ['payment_method', 'balances'],
              filters: {
                countries: ['US'],
              },
              return_url: options?.redirectUrl,
            },
          }) as { id: string; client_secret: string; url: string };

          return {
            success: true,
            method: 'financial_connections',
            strength: 'strong',
            sessionUrl: session.url,
            sessionId: session.id,
            providerRef: session.id,
          };
        } catch {
          // Fall back to micro-deposits if Financial Connections fails
          console.log('[Stripe ACH] Financial Connections not available, falling back to micro-deposits');
        }
      }

      // Fall back to micro-deposits
      // First create a SetupIntent to set up the bank account for future use
      const setupIntent = await stripeRequest('/setup_intents', creds, {
        method: 'POST',
        body: {
          payment_method_types: ['us_bank_account'],
          payment_method_data: {
            type: 'us_bank_account',
            us_bank_account: {
              account_holder_type: bankAccount.accountHolderType,
              account_type: bankAccount.accountType,
              routing_number: bankAccount.routingNumber,
              account_number: bankAccount.accountNumber,
            },
            billing_details: {
              name: bankAccount.accountHolderName,
            },
          },
          payment_method_options: {
            us_bank_account: {
              verification_method: 'microdeposits',
            },
          },
          confirm: true,
        },
      }) as {
        id: string;
        status: string;
        next_action?: {
          type: string;
          verify_with_microdeposits?: {
            arrival_date: number;
            microdeposit_type: string;
          };
        };
        payment_method: string;
      };

      // Stripe will send micro-deposits automatically
      const arrivalDate = setupIntent.next_action?.verify_with_microdeposits?.arrival_date;

      return {
        success: true,
        method: 'micro_deposits',
        strength: 'basic',
        expiresAt: arrivalDate
          ? new Date((arrivalDate + 10 * 24 * 60 * 60) * 1000).toISOString() // 10 days to verify
          : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        providerRef: setupIntent.id,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        method: 'micro_deposits',
        strength: 'basic',
        error: err.message,
      };
    }
  },

  async verifyMicroDeposits(
    bankAccountId: string, // This should be the SetupIntent ID from initiateVerification
    amounts: [number, number],
    credentials: Record<string, string>
  ): Promise<{ success: boolean; paymentMethodId?: string; error?: string }> {
    try {
      const creds = credentials as unknown as StripeCredentials;

      // Verify the micro-deposits on the SetupIntent
      const verifyResult = await stripeRequest(`/setup_intents/${bankAccountId}/verify_microdeposits`, creds, {
        method: 'POST',
        body: {
          amounts: amounts, // e.g., [32, 45] for $0.32 and $0.45
        },
      }) as { payment_method: string };

      // Return the payment method ID from the verified SetupIntent
      return {
        success: true,
        paymentMethodId: verifyResult.payment_method,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        error: err.message,
      };
    }
  },

  async checkVerificationStatus(
    providerRef: string,
    credentials: Record<string, string>
  ): Promise<{
    status: 'pending' | 'verified' | 'failed';
    verifiedAt?: string;
    paymentMethodId?: string;
    error?: string;
  }> {
    try {
      const creds = credentials as unknown as StripeCredentials;

      // Check if it's a SetupIntent (micro-deposits) or Financial Connections session
      if (providerRef.startsWith('seti_')) {
        const setupIntent = await stripeRequest(`/setup_intents/${providerRef}`, creds, {
          method: 'GET',
        }) as { status: string; payment_method: string | null };

        return {
          status: setupIntent.status === 'succeeded' ? 'verified' :
                  setupIntent.status === 'canceled' ? 'failed' : 'pending',
          verifiedAt: setupIntent.status === 'succeeded' ? new Date().toISOString() : undefined,
          paymentMethodId: setupIntent.payment_method || undefined,
        };
      } else if (providerRef.startsWith('fcsess_')) {
        const session = await stripeRequest(`/financial_connections/sessions/${providerRef}`, creds, {
          method: 'GET',
        }) as { accounts: { data: { id: string }[] } };

        return {
          status: session.accounts?.data?.length > 0 ? 'verified' : 'pending',
          verifiedAt: session.accounts?.data?.length > 0 ? new Date().toISOString() : undefined,
        };
      }

      return { status: 'pending' };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        status: 'failed',
        error: err.message,
      };
    }
  },

  getSettlementEstimate(direction, amount) {
    // Same-day ACH cutoff is typically 2:45 PM ET for credits, 4:45 PM ET for debits
    // Standard ACH: 3-5 business days
    const now = new Date();
    const hour = now.getUTCHours() - 5; // Approximate ET

    const sameDayEligible = direction === 'debit'
      ? hour < 16 && amount <= 100000000 // $1M limit for same-day
      : hour < 14 && amount <= 100000000;

    return {
      estimatedDays: sameDayEligible ? 0 : 4,
      sameDayEligible,
      cutoffTime: direction === 'debit' ? '4:45 PM ET' : '2:45 PM ET',
    };
  },
};
