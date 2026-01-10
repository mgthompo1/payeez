import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateClientSecret } from '../_shared/auth.ts';
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
import { getCardDataFromVault, markTokenUsed } from '../_shared/vault.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay' | 'bank_account';

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
};

// Maximum retry attempts
const MAX_RETRY_ATTEMPTS = 3;

serve(async (req) => {
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
      return new Response(
        JSON.stringify({ error: 'Session ID required. Provide in URL path or request body as session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Client secret required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientSecret = authHeader.slice(7);
    const auth = await authenticateClientSecret(sessionId, clientSecret, supabaseUrl, supabaseServiceKey);

    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Invalid session or client secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { session, tenantId } = auth;

    if (session.status === 'succeeded') {
      return new Response(
        JSON.stringify({ error: 'Session already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.status !== 'requires_payment_method' && session.status !== 'processing') {
      return new Response(
        JSON.stringify({ error: `Cannot confirm session in status: ${session.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ConfirmRequest = await req.json();
    const paymentMethodType = body.payment_method_type || 'card';
    const tokenProvider = body.token_provider || 'basis_theory';

    // Validation
    if (paymentMethodType === 'card' && !body.token_id) {
      return new Response(
        JSON.stringify({ error: 'token_id is required for card payments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentMethodType === 'apple_pay' && !body.apple_pay_token) {
      return new Response(
        JSON.stringify({ error: 'apple_pay_token is required for Apple Pay' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentMethodType === 'google_pay' && !body.google_pay_token) {
      return new Response(
        JSON.stringify({ error: 'google_pay_token is required for Google Pay' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const orchestrator = createOrchestrator(supabase);

    // Update session status
    await supabase
      .from('payment_sessions')
      .update({ status: 'processing' })
      .eq('id', sessionId);

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

      // Generate idempotency key
      const idempotencyKey = `${sessionId}_${attemptNumber}_${Date.now()}`;

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
        // For Windcave with Atlas vault, we need to retrieve card data first
        let cardData = null;
        if (decision.psp === 'windcave' && tokenProvider === 'atlas') {
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

        if (result.success) {
          // Payment succeeded!
          const sessionStatus = result.status === 'captured' ? 'succeeded' : 'processing';
          await supabase
            .from('payment_sessions')
            .update({ status: sessionStatus })
            .eq('id', sessionId);

          return new Response(
            JSON.stringify({
              id: attempt?.id,
              session_id: sessionId,
              amount: session.amount,
              currency: session.currency,
              status: result.status,
              payment_method_type: paymentMethodType,
              psp: decision.psp,
              psp_transaction_id: result.transactionId,
              captured_amount: result.status === 'captured' ? session.amount : 0,
              refunded_amount: 0,
              card: result.card,
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
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // All attempts exhausted - return failure
    await supabase
      .from('payment_sessions')
      .update({ status: 'failed' })
      .eq('id', sessionId);

    return new Response(
      JSON.stringify({
        error: lastResult?.failureMessage || 'Payment failed after all retry attempts',
        code: lastResult?.failureCode || 'all_attempts_failed',
        attempts: attemptNumber,
        last_psp: lastDecision?.psp,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
