import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateClientSecret, buildCorsHeaders } from '../_shared/auth.ts';
import { fetchPSPCredentials } from '../_shared/psp.ts';
import { createOrchestrator, type RouteDecision, type RetryContext } from '../_shared/orchestrator.ts';
import { stripeAdapter } from '../_shared/adapters/stripe.ts';
import { adyenAdapter } from '../_shared/adapters/adyen.ts';
import { authorizenetAdapter } from '../_shared/adapters/authorizenet.ts';
import { chaseAdapter } from '../_shared/adapters/chase.ts';
import { nuveiAdapter } from '../_shared/adapters/nuvei.ts';
import { dlocalAdapter } from '../_shared/adapters/dlocal.ts';
import { braintreeAdapter } from '../_shared/adapters/braintree.ts';
import { checkoutcomAdapter } from '../_shared/adapters/checkoutcom.ts';
import { airwallexAdapter } from '../_shared/adapters/airwallex.ts';
import { windcaveAdapter } from '../_shared/adapters/windcave.ts';
import { paypalAdapter } from '../_shared/adapters/paypal.ts';
import { getCardDataFromVault, markTokenUsed } from '../_shared/vault.ts';
import {
  getRequestContext,
  authenticationError,
  invalidRequestError,
  cardError,
  idempotencyError,
  apiError,
  createSuccessResponse,
  paymentFailedError,
  createErrorResponse,
} from '../_shared/responses.ts';

type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay' | 'bank_account' | 'paypal';

interface ConfirmRequest {
  payment_method_type: PaymentMethodType;
  token_id: string;
  token_provider: 'basis_theory' | 'vgs' | 'atlas';
  psp?: string;
  routing_profile_id?: string;
  apple_pay_token?: string;
  google_pay_token?: string;
  bank_account?: {
    account_holder_name?: string;
    account_type?: 'checking' | 'savings';
  };
  // VGS-specific data with field aliases
  vgs_data?: {
    card_number: string;
    card_expiry: string;
    card_cvc: string;
  };
}

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
  paypal: paypalAdapter,
};

// Maximum retry attempts
const MAX_RETRY_ATTEMPTS = 3;

serve(async (req) => {
  const { requestId, corsOrigin } = getRequestContext(req);
  const corsHeaders = buildCorsHeaders(corsOrigin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const basisTheoryApiKey = Deno.env.get('BASIS_THEORY_PRIVATE_KEY')!;
    const vgsVaultId = Deno.env.get('VGS_VAULT_ID');

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    let sessionId = pathParts[pathParts.length - 1];

    // If session ID not in path, try to get from body (clone request since we'll read body later)
    if (!sessionId || sessionId === 'confirm-payment') {
      try {
        const bodyClone = await req.clone().json();
        sessionId = bodyClone.session_id;
      } catch {
        // Body parsing failed, continue with path-based check
      }
    }

    if (!sessionId || sessionId === 'confirm-payment') {
      return invalidRequestError(
        'Session ID required. Provide in URL path or request body as session_id',
        'parameter_missing',
        'session_id',
        requestId,
        corsOrigin
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return authenticationError(
        'Client secret required in Authorization header',
        'missing_client_secret',
        requestId,
        corsOrigin
      );
    }

    const clientSecret = authHeader.slice(7);
    const auth = await authenticateClientSecret(sessionId, clientSecret, supabaseUrl, supabaseServiceKey);

    if (!auth) {
      return authenticationError(
        'Invalid session ID or client secret',
        'invalid_client_secret',
        requestId,
        corsOrigin
      );
    }

    const { session, tenantId } = auth;

    if (session.status === 'succeeded') {
      return createErrorResponse({
        type: 'invalid_request_error',
        code: 'session_already_completed',
        message: 'This payment session has already been completed',
        requestId,
        corsOrigin,
      });
    }

    // Only allow confirmation from requires_payment_method status
    // Do NOT allow re-confirmation from 'processing' - this prevents double-charges
    if (session.status !== 'requires_payment_method') {
      if (session.status === 'processing') {
        return idempotencyError(
          'Payment is already being processed. Please wait for completion.',
          'session_already_processing',
          requestId,
          corsOrigin
        );
      }
      return createErrorResponse({
        type: 'invalid_request_error',
        code: 'invalid_session_state',
        message: `Cannot confirm session in status: ${session.status}`,
        requestId,
        corsOrigin,
      });
    }

    // CRITICAL: Parse and validate body BEFORE acquiring the lock
    // This prevents the session from getting stuck in 'processing' if validation fails
    let body: ConfirmRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return invalidRequestError(
        'Invalid JSON in request body',
        'invalid_json',
        undefined,
        requestId,
        corsOrigin
      );
    }

    const paymentMethodType = body.payment_method_type || 'card';
    const tokenProvider = body.token_provider || 'basis_theory';

    // Validation BEFORE lock acquisition
    if (paymentMethodType === 'card' && !body.token_id) {
      return invalidRequestError(
        'token_id is required for card payments',
        'parameter_missing',
        'token_id',
        requestId,
        corsOrigin
      );
    }

    if (paymentMethodType === 'apple_pay' && !body.apple_pay_token) {
      return invalidRequestError(
        'apple_pay_token is required for Apple Pay',
        'parameter_missing',
        'apple_pay_token',
        requestId,
        corsOrigin
      );
    }

    if (paymentMethodType === 'google_pay' && !body.google_pay_token) {
      return invalidRequestError(
        'google_pay_token is required for Google Pay',
        'parameter_missing',
        'google_pay_token',
        requestId,
        corsOrigin
      );
    }

    // Validate PayPal requirements - only works with atlas vault for card processing
    if (paymentMethodType === 'card' && body.psp === 'paypal' && tokenProvider !== 'atlas') {
      return invalidRequestError(
        'PayPal card processing requires atlas vault. Set token_provider to "atlas".',
        'invalid_token_provider',
        'token_provider',
        requestId,
        corsOrigin
      );
    }

    // Reject bank_account - ACH payments use the dedicated /bank-transfers API
    if (paymentMethodType === 'bank_account') {
      return invalidRequestError(
        'Bank account (ACH) payments must use the /bank-transfers API, not /confirm-payment. ' +
        'Create a bank account via /bank-accounts, set up a mandate via /bank-mandates, ' +
        'then initiate the transfer via POST /bank-transfers.',
        'invalid_payment_method',
        'payment_method_type',
        requestId,
        corsOrigin
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // NOW acquire per-session lock using atomic status update
    // This prevents race conditions where multiple requests try to confirm simultaneously
    const { data: lockResult, error: lockError } = await supabase
      .from('payment_sessions')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('status', 'requires_payment_method') // Only update if still in expected state
      .select('id')
      .single();

    if (lockError || !lockResult) {
      // Another request already started processing
      return idempotencyError(
        'Payment is already being processed or session state changed',
        'concurrent_request',
        requestId,
        corsOrigin
      );
    }

    // Helper to release lock on error (reset to requires_payment_method)
    const releaseLock = async () => {
      await supabase
        .from('payment_sessions')
        .update({ status: 'requires_payment_method', updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('status', 'processing');
    };

    const orchestrator = createOrchestrator(supabase);

    // Get tenant environment
    const { data: tenant } = await supabase
      .from('tenants')
      .select('environment')
      .eq('id', tenantId)
      .single();

    const environment = (tenant?.environment || 'test') as 'test' | 'live';

    // Prepare vault token and credentials
    let vaultTokenId = body.token_id;
    let vaultApiKey = basisTheoryApiKey;
    let vgsConfig: { vaultId: string; credentials: string } | null = null;

    if (tokenProvider === 'vgs' && vgsVaultId) {
      vaultApiKey = Deno.env.get('VGS_ACCESS_CREDENTIALS') || '';
      vgsConfig = {
        vaultId: vgsVaultId,
        credentials: vaultApiKey,
      };
      // For VGS, the token_id is the card number alias
      // Store all VGS aliases for proxy requests
      if (body.vgs_data) {
        vaultTokenId = body.vgs_data.card_number;
      }
    }

    // Handle wallet token decryption
    if (paymentMethodType === 'apple_pay' && body.apple_pay_token) {
      const decryptResponse = await fetch('https://api.basistheory.com/tokens', {
        method: 'POST',
        headers: {
          'BT-API-KEY': basisTheoryApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'apple_pay',
          data: JSON.parse(body.apple_pay_token),
        }),
      });
      const decryptedToken = await decryptResponse.json();
      vaultTokenId = decryptedToken.id;
    }

    if (paymentMethodType === 'google_pay' && body.google_pay_token) {
      const decryptResponse = await fetch('https://api.basistheory.com/tokens', {
        method: 'POST',
        headers: {
          'BT-API-KEY': basisTheoryApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'google_pay',
          data: JSON.parse(body.google_pay_token),
        }),
      });
      const decryptedToken = await decryptResponse.json();
      vaultTokenId = decryptedToken.id;
    }

    // Get or create token reference
    let token = null;
    if (paymentMethodType === 'card' || paymentMethodType === 'bank_account') {
      if (tokenProvider === 'atlas') {
        // For Atlas vault, look up the existing token (created by tokenize-card)
        const { data: existingToken } = await supabase
          .from('tokens')
          .select('*')
          .eq('vault_token_id', vaultTokenId)
          .eq('is_active', true)
          .single();

        if (existingToken) {
          token = existingToken;
          // Update the token with customer email if not set
          if (!existingToken.customer_email && session.customer_email) {
            await supabase
              .from('tokens')
              .update({ customer_email: session.customer_email })
              .eq('id', existingToken.id);
          }
        } else {
          console.error('[ConfirmPayment] Atlas token not found:', vaultTokenId);
        }
      } else {
        // For other providers, create a new token reference
        const { data } = await supabase
          .from('tokens')
          .insert({
            tenant_id: tenantId,
            customer_email: session.customer_email,
            vault_provider: tokenProvider,
            vault_token_id: vaultTokenId,
          })
          .select()
          .single();
        token = data;
      }
    }

    // Build route context
    const routeContext = {
      tenantId,
      sessionId,
      amount: session.amount,
      currency: session.currency,
      paymentMethod: paymentMethodType,
      environment,
    };

    const forcedPsp = body.psp;
    const routingProfileId = body.routing_profile_id;

    // ============================================
    // Payment Processing with Retry Logic
    // ============================================

    let attemptNumber = 0;
    let lastResult: any = null;
    let lastAttempt: any = null;
    let lastDecision: RouteDecision | null = null;

    while (attemptNumber < MAX_RETRY_ATTEMPTS) {
      attemptNumber++;

      // Get route decision
      let decision: RouteDecision | null;

      if (attemptNumber === 1) {
        if (forcedPsp) {
          decision = await getForcedDecision(
            forcedPsp,
            tenantId,
            environment,
            supabase
          );
          if (decision) {
            await orchestrator.logForcedDecision(
              routeContext,
              decision.psp,
              routingProfileId
            );
          }
        } else if (routingProfileId) {
          decision = await orchestrator.selectPSPWithProfile(
            routingProfileId,
            routeContext
          );
        } else {
          // Initial attempt - use orchestrator to select PSP
          decision = await orchestrator.selectPSP(routeContext);
        }
      } else {
        if (forcedPsp) {
          break;
        }
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
          // No PSP available at all
          await supabase
            .from('payment_sessions')
            .update({ status: 'failed' })
            .eq('id', sessionId);

          return new Response(
            JSON.stringify({ error: 'No PSP configured for this tenant' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // No more retry options
        break;
      }

      lastDecision = decision;

      // Get adapter
      const adapter = adapters[decision.psp];
      if (!adapter) {
        console.error(`No adapter for PSP: ${decision.psp}`);
        continue; // Try next PSP
      }

      // Generate stable idempotency key - same session + attempt = same key
      // This prevents duplicate charges if the same request is retried
      const idempotencyKey = `atlas_${sessionId}_attempt_${attemptNumber}`;

      // Record payment attempt
      const { data: attempt } = await supabase
        .from('payment_attempts')
        .insert({
          session_id: sessionId,
          tenant_id: tenantId,
          token_id: token?.id,
          psp: decision.psp,
          routing_profile_id: routingProfileId ?? decision.profileId ?? null,
          idempotency_key: idempotencyKey,
          amount: session.amount,
          currency: session.currency,
          status: 'pending',
          captured_amount: 0,
          refunded_amount: 0,
          payment_method_type: paymentMethodType,
          wallet_type: ['apple_pay', 'google_pay'].includes(paymentMethodType) ? paymentMethodType : null,
        })
        .select()
        .single();

      lastAttempt = attempt;

      // Process payment
      const startTime = Date.now();

      try {
        // For PSPs that need raw card data (not token-based), retrieve from Atlas vault
        // - Windcave: Uses direct card data
        // - PayPal: Uses card data for Advanced Card Processing (requires PCI SAQ D)
        let cardData = null;
        const pspsNeedingCardData = ['windcave', 'paypal'];
        if (pspsNeedingCardData.includes(decision.psp) && tokenProvider === 'atlas') {
          const decryptedCard = await getCardDataFromVault(vaultTokenId, sessionId);
          if (!decryptedCard) {
            throw new Error('Failed to retrieve card data from vault');
          }
          cardData = {
            cardNumber: decryptedCard.pan,
            cardHolderName: decryptedCard.cardHolderName || 'Card Holder',
            expiryMonth: decryptedCard.expiryMonth,
            expiryYear: decryptedCard.expiryYear,
            cvc: decryptedCard.cvc,
          };
        }

        // Environment is now included in credentials from the PSP config
        const credentialsWithEnv = decision.credentials;

        const result = await adapter.authorize(
          {
            // Core payment data
            amount: session.amount,
            currency: session.currency,
            tokenId: vaultTokenId,
            cardData, // For Windcave
            paymentMethodType,
            idempotencyKey,
            capture: session.capture_method === 'automatic',

            // Merchant reference (use session's merchant_reference if set, fallback to sessionId)
            merchantReference: session.merchant_reference || sessionId,

            // Customer data
            customer: {
              email: session.customer_email,
              name: session.customer_name,
              phone: session.customer_phone,
            },

            // Addresses for AVS/fraud
            billingAddress: session.billing_address,
            shippingAddress: session.shipping_address,

            // Browser info for 3DS
            browser: {
              ipAddress: session.browser_ip,
              userAgent: session.browser_user_agent,
            },

            // Display
            statementDescriptor: session.statement_descriptor,
            description: session.description,

            // Metadata
            metadata: session.metadata,

            // Bank account for ACH
            bankAccount: paymentMethodType === 'bank_account' ? body.bank_account : undefined,

            // VGS-specific data for proxy requests
            tokenProvider,
            vgsConfig: vgsConfig || undefined,
            vgsData: body.vgs_data,

            // Legacy compatibility
            customerEmail: session.customer_email,
          },
          credentialsWithEnv as { secret_key: string },
          vaultApiKey!
        );

        const latencyMs = Date.now() - startTime;
        lastResult = result;

        // Update attempt record with results including AVS/3DS
        await supabase
          .from('payment_attempts')
          .update({
            status: result.status,
            psp_transaction_id: result.transactionId,
            captured_amount: result.status === 'captured' ? session.amount : 0,
            refunded_amount: 0,
            failure_code: result.failureCode,
            failure_message: result.failureMessage,
            failure_category: result.failureCategory,
            raw_response: result.rawResponse,
            // Browser IP from session
            browser_ip: session.browser_ip,
            // AVS/CVV results
            avs_result: result.avsResult,
            cvv_result: result.cvvResult,
            // 3DS results
            three_ds_version: result.threeDsVersion,
            three_ds_status: result.threeDsStatus,
            three_ds_eci: result.threeDsEci,
          })
          .eq('id', attempt?.id);

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
          sessionId,
          result.success ? 'success' : 'failure'
        );

        // Update token with card details
        if (result.card && token) {
          await supabase
            .from('tokens')
            .update({
              card_brand: result.card.brand,
              card_last4: result.card.last4,
              card_exp_month: result.card.exp_month,
              card_exp_year: result.card.exp_year,
            })
            .eq('id', token.id);
        }

        // Handle 3DS or redirect flow (requires_action)
        if (result.status === 'requires_action') {
          // Update session status to requires_action
          await supabase
            .from('payment_sessions')
            .update({ status: 'requires_action' })
            .eq('id', sessionId);

          // Store next action details for resumption
          if (attempt?.id) {
            await supabase
              .from('payment_attempts')
              .update({
                status: 'requires_action',
                psp_transaction_id: result.transactionId,
                raw_response: result.rawResponse,
              })
              .eq('id', attempt.id);
          }

          return createSuccessResponse(
            {
              id: attempt?.id,
              object: 'payment_intent',
              session_id: sessionId,
              amount: session.amount,
              currency: session.currency,
              status: 'requires_action',
              payment_method_type: paymentMethodType,
              psp: decision.psp,
              psp_transaction_id: result.transactionId,
              // 3DS / redirect action details - Stripe-compatible format
              next_action: result.nextAction ? {
                type: result.nextAction.type,
                redirect_to_url: {
                  url: result.nextAction.url,
                  return_url: session.success_url,
                },
              } : undefined,
              // Include 3DS details if available
              three_d_secure: result.threeDsVersion ? {
                version: result.threeDsVersion,
                authentication_status: result.threeDsStatus,
                eci: result.threeDsEci,
              } : undefined,
              routing: {
                attempts: attemptNumber,
                selected_psp: decision.psp,
                selection_reason: decision.reason,
              },
              created_at: attempt?.created_at,
              livemode: environment === 'live',
            },
            200,
            { requestId, corsOrigin }
          );
        }

        if (result.success) {
          // Payment succeeded!
          const sessionStatus = result.status === 'captured' ? 'succeeded' : 'processing';
          await supabase
            .from('payment_sessions')
            .update({ status: sessionStatus })
            .eq('id', sessionId);

          // PCI Compliance: Mark token as used and clear sensitive data (CVC)
          // This prevents CVC from being stored after authorization
          if (tokenProvider === 'atlas' && vaultTokenId) {
            await markTokenUsed(vaultTokenId);
          }

          return createSuccessResponse(
            {
              id: attempt?.id,
              object: 'payment_intent',
              session_id: sessionId,
              amount: session.amount,
              currency: session.currency,
              status: result.status,
              payment_method_type: paymentMethodType,
              psp: decision.psp,
              psp_transaction_id: result.transactionId,
              captured_amount: result.status === 'captured' ? session.amount : 0,
              refunded_amount: 0,
              card: result.card ? {
                brand: result.card.brand,
                last4: result.card.last4,
                exp_month: result.card.exp_month,
                exp_year: result.card.exp_year,
              } : undefined,
              wallet: ['apple_pay', 'google_pay'].includes(paymentMethodType)
                ? { type: paymentMethodType, card_network: result.card?.brand }
                : undefined,
              bank_account: paymentMethodType === 'bank_account' && result.bankAccount
                ? result.bankAccount
                : undefined,
              routing: {
                attempts: attemptNumber,
                selected_psp: decision.psp,
                selection_reason: decision.reason,
                is_retry: decision.isRetry,
              },
              created_at: attempt?.created_at,
              livemode: environment === 'live',
            },
            200,
            { requestId, corsOrigin }
          );
        }

        // Payment failed - check if we should retry
        const shouldRetry = isRetryableFailure(result.failureCode, result.failureCategory);

        if (!shouldRetry) {
          break; // Non-retryable failure
        }

        // Add delay before retry if configured
        const retryDelay = decision.isRetry ? 100 : 0;
        if (retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      } catch (err) {
        console.error(`Payment attempt ${attemptNumber} error:`, err);

        await supabase
          .from('payment_attempts')
          .update({
            status: 'failed',
            failure_code: 'processor_error',
            failure_message: err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('id', attempt?.id);

        lastResult = {
          success: false,
          failureCode: 'processor_error',
          failureMessage: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    }

    // All attempts exhausted - return failure with 402 status (Stripe convention)
    await supabase
      .from('payment_sessions')
      .update({ status: 'failed' })
      .eq('id', sessionId);

    return paymentFailedError(
      lastResult?.failureMessage || 'Payment failed after all retry attempts',
      lastResult?.failureCode,
      lastResult?.failureMessage,
      requestId,
      corsOrigin
    );
  } catch (err: any) {
    console.error('Unexpected error:', err);

    // Release the lock if we acquired it (session might be stuck in 'processing')
    // This happens when an unexpected error occurs after lock acquisition
    // Only attempt if sessionId is a valid UUID (not 'confirm-payment' placeholder)
    if (sessionId && sessionId !== 'confirm-payment' && !sessionId.includes('/')) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('payment_sessions')
          .update({ status: 'requires_payment_method', updated_at: new Date().toISOString() })
          .eq('id', sessionId)
          .eq('status', 'processing');
      } catch {
        // Ignore lock release errors in catch block
      }
    }

    return apiError(
      'An unexpected error occurred while processing the payment',
      'internal_error',
      requestId,
      corsOrigin
    );
  }
});

async function getForcedDecision(
  psp: string,
  tenantId: string,
  environment: 'test' | 'live',
  supabase: any
): Promise<RouteDecision | null> {
  const credentials = await fetchPSPCredentials(
    supabase,
    tenantId,
    psp,
    environment,
    { logErrors: true }
  );
  if (!credentials) {
    return null;
  }

  return {
    psp,
    credentials,
    reason: 'forced',
    candidates: [{ psp, weight: 100 }],
    isRetry: false,
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
