/**
 * Shared Payment Processor
 * Handles charging tokens via the payment orchestrator
 * Used by billing-engine for invoice charging and subscription renewals
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOrchestrator, type RouteDecision, type RetryContext } from './orchestrator.ts';
import { getCardDataFromVault } from './vault.ts';
import { stripeAdapter } from './adapters/stripe.ts';
import { adyenAdapter } from './adapters/adyen.ts';
import { authorizenetAdapter } from './adapters/authorizenet.ts';
import { chaseAdapter } from './adapters/chase.ts';
import { nuveiAdapter } from './adapters/nuvei.ts';
import { dlocalAdapter } from './adapters/dlocal.ts';
import { braintreeAdapter } from './adapters/braintree.ts';
import { checkoutcomAdapter } from './adapters/checkoutcom.ts';
import { airwallexAdapter } from './adapters/airwallex.ts';
import { windcaveAdapter } from './adapters/windcave.ts';

const adapters: Record<string, any> = {
  stripe: stripeAdapter,
  adyen: adyenAdapter,
  authorizenet: authorizenetAdapter,
  chase: chaseAdapter,
  nuvei: nuveiAdapter,
  dlocal: dlocalAdapter,
  braintree: braintreeAdapter,
  checkoutcom: checkoutcomAdapter,
  airwallex: airwallexAdapter,
  windcave: windcaveAdapter,
};

const MAX_RETRY_ATTEMPTS = 3;

export interface ChargeRequest {
  tenantId: string;
  tokenId: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  invoiceId?: string;
  subscriptionId?: string;
  idempotencyKey?: string;
}

export interface ChargeResult {
  success: boolean;
  transactionId?: string;
  psp?: string;
  status?: 'authorized' | 'captured' | 'failed';
  failureCode?: string;
  failureMessage?: string;
  failureCategory?: string;
  attempts?: number;
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  };
}

/**
 * Charge a stored token via the payment orchestrator
 * Handles PSP selection, routing, retries, and failover
 */
export async function chargeToken(
  supabase: SupabaseClient,
  request: ChargeRequest
): Promise<ChargeResult> {
  const orchestrator = createOrchestrator(supabase);
  const basisTheoryApiKey = Deno.env.get('BASIS_THEORY_PRIVATE_KEY') || '';

  // Get the token from the database
  const { data: token, error: tokenError } = await supabase
    .from('tokens')
    .select('*')
    .eq('id', request.tokenId)
    .eq('is_active', true)
    .single();

  if (tokenError || !token) {
    console.error('[PaymentProcessor] Token not found:', request.tokenId);
    return {
      success: false,
      failureCode: 'token_not_found',
      failureMessage: 'Payment method not found or inactive',
    };
  }

  // Get tenant environment
  const { data: tenant } = await supabase
    .from('tenants')
    .select('environment')
    .eq('id', request.tenantId)
    .single();

  const environment = (tenant?.environment || 'test') as 'test' | 'live';

  // Generate a unique session ID for routing (using invoice or subscription ID)
  const routingSessionId = request.invoiceId || request.subscriptionId || crypto.randomUUID();

  // Build route context
  const routeContext = {
    tenantId: request.tenantId,
    sessionId: routingSessionId,
    amount: request.amount,
    currency: request.currency,
    paymentMethod: 'card',
    environment,
  };

  // Payment processing with retry logic
  let attemptNumber = 0;
  let lastResult: ChargeResult | null = null;
  let lastDecision: RouteDecision | null = null;

  while (attemptNumber < MAX_RETRY_ATTEMPTS) {
    attemptNumber++;

    // Get route decision
    let decision: RouteDecision | null;

    if (attemptNumber === 1) {
      // Initial attempt - use orchestrator to select PSP
      decision = await orchestrator.selectPSP(routeContext);
    } else {
      // Retry attempt - get retry/failover PSP
      const retryContext: RetryContext = {
        failedPsp: lastDecision!.psp,
        failureCode: lastResult?.failureCode,
        failureCategory: lastResult?.failureCategory,
        attemptNumber,
      };
      decision = await orchestrator.selectRetryPSP(routeContext, retryContext);
    }

    if (!decision) {
      if (attemptNumber === 1) {
        return {
          success: false,
          failureCode: 'no_psp_configured',
          failureMessage: 'No payment processor configured',
        };
      }
      // No more retry options
      break;
    }

    lastDecision = decision;

    // Get adapter
    const adapter = adapters[decision.psp];
    if (!adapter) {
      console.error(`[PaymentProcessor] No adapter for PSP: ${decision.psp}`);
      continue; // Try next PSP
    }

    // Generate idempotency key
    const idempotencyKey = request.idempotencyKey ||
      `${request.invoiceId || request.subscriptionId || 'charge'}_${attemptNumber}_${Date.now()}`;

    const startTime = Date.now();

    try {
      // For Windcave with Atlas vault, we need to retrieve card data first
      let cardData = null;
      if (decision.psp === 'windcave' && token.vault_provider === 'atlas') {
        const decryptedCard = await getCardDataFromVault(token.vault_token_id);
        if (!decryptedCard) {
          throw new Error('Failed to retrieve card data from vault');
        }
        cardData = {
          cardNumber: decryptedCard.pan,
          cardHolderName: decryptedCard.cardHolderName || request.customerName || 'Card Holder',
          expiryMonth: decryptedCard.expiryMonth,
          expiryYear: decryptedCard.expiryYear,
          cvc: decryptedCard.cvc,
        };
      }

      const result = await adapter.authorize(
        {
          amount: request.amount,
          currency: request.currency,
          tokenId: token.vault_token_id,
          cardData, // For Windcave
          paymentMethodType: 'card',
          idempotencyKey,
          capture: true, // Auto-capture for billing

          merchantReference: request.invoiceId || request.subscriptionId || idempotencyKey,

          customer: {
            email: request.customerEmail,
            name: request.customerName,
          },

          description: request.description,
          metadata: request.metadata,

          tokenProvider: token.vault_provider,
          customerEmail: request.customerEmail,
        },
        decision.credentials as { secret_key: string },
        basisTheoryApiKey
      );

      const latencyMs = Date.now() - startTime;

      // Update PSP metrics
      if (decision.profileId) {
        await orchestrator.updatePSPMetrics(
          decision.profileId,
          decision.psp,
          result.success,
          latencyMs
        );
      }

      // Update routing decision outcome
      await orchestrator.updateDecisionOutcome(
        routingSessionId,
        result.success ? 'success' : 'failure'
      );

      if (result.success) {
        return {
          success: true,
          transactionId: result.transactionId,
          psp: decision.psp,
          status: result.status === 'captured' ? 'captured' : 'authorized',
          attempts: attemptNumber,
          card: result.card,
        };
      }

      // Payment failed - check if we should retry
      lastResult = {
        success: false,
        psp: decision.psp,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
        failureCategory: result.failureCategory,
        attempts: attemptNumber,
      };

      const shouldRetry = isRetryableFailure(result.failureCode, result.failureCategory);
      if (!shouldRetry) {
        break; // Non-retryable failure
      }

      // Small delay before retry
      if (attemptNumber < MAX_RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error(`[PaymentProcessor] Attempt ${attemptNumber} error:`, err);

      lastResult = {
        success: false,
        psp: decision.psp,
        failureCode: 'processor_error',
        failureMessage: err instanceof Error ? err.message : 'Unknown error',
        failureCategory: 'processor_error',
        attempts: attemptNumber,
      };
    }
  }

  // All attempts exhausted - return failure
  return lastResult || {
    success: false,
    failureCode: 'all_attempts_failed',
    failureMessage: 'Payment failed after all retry attempts',
    attempts: attemptNumber,
  };
}

/**
 * Determine if a failure is retryable
 */
function isRetryableFailure(code?: string, category?: string): boolean {
  // Non-retryable failures
  const nonRetryable = [
    'card_declined',
    'insufficient_funds',
    'expired_card',
    'invalid_card',
    'fraud_detected',
    'do_not_honor',
    'card_not_supported',
    'currency_not_supported',
    'duplicate_transaction',
  ];

  if (code && nonRetryable.includes(code)) {
    return false;
  }

  // Retryable categories
  const retryableCategories = [
    'processor_error',
    'network_error',
    'timeout',
    'rate_limit',
    'temporary_failure',
  ];

  if (category && retryableCategories.includes(category)) {
    return true;
  }

  // Default: retry on generic errors
  return code === 'processor_error' || code === 'gateway_error' || !code;
}
