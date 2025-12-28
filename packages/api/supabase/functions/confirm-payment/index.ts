import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateClientSecret, generateSecureToken } from '../_shared/auth.ts';
import { routePayment } from '../_shared/router.ts';
import { stripeAdapter } from '../_shared/adapters/stripe.ts';
import { adyenAdapter } from '../_shared/adapters/adyen.ts';
import { authorizenetAdapter } from '../_shared/adapters/authorizenet.ts';
import { chaseAdapter } from '../_shared/adapters/chase.ts';
import { nuveiAdapter } from '../_shared/adapters/nuvei.ts';
import { dlocalAdapter } from '../_shared/adapters/dlocal.ts';
import { braintreeAdapter } from '../_shared/adapters/braintree.ts';
import { checkoutcomAdapter } from '../_shared/adapters/checkoutcom.ts';
import { airwallexAdapter } from '../_shared/adapters/airwallex.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ConfirmRequest {
  token_id: string;
  token_provider: 'basis_theory';
}

const adapters: Record<string, typeof stripeAdapter> = {
  stripe: stripeAdapter,
  adyen: adyenAdapter,
  authorizenet: authorizenetAdapter,
  chase: chaseAdapter,
  nuvei: nuveiAdapter,
  dlocal: dlocalAdapter,
  braintree: braintreeAdapter,
  checkoutcom: checkoutcomAdapter,
  airwallex: airwallexAdapter,
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const basisTheoryApiKey = Deno.env.get('BASIS_THEORY_PRIVATE_KEY')!;

    // Extract session ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[pathParts.length - 1];

    if (!sessionId || sessionId === 'confirm-payment') {
      return new Response(
        JSON.stringify({ error: 'Session ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client secret from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Client secret required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientSecret = authHeader.slice(7);

    // Authenticate client secret
    const auth = await authenticateClientSecret(
      sessionId,
      clientSecret,
      supabaseUrl,
      supabaseServiceKey
    );

    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Invalid session or client secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { session, tenantId } = auth;

    // Check session status
    if (session.status === 'succeeded') {
      return new Response(
        JSON.stringify({ error: 'Session already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.status !== 'requires_payment_method') {
      return new Response(
        JSON.stringify({ error: `Cannot confirm session in status: ${session.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ConfirmRequest = await req.json();

    if (!body.token_id) {
      return new Response(
        JSON.stringify({ error: 'token_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update session status to processing
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

    const environment = tenant?.environment || 'test';

    // Route payment to appropriate PSP
    const routeDecision = await routePayment(
      tenantId,
      session.amount,
      session.currency,
      environment,
      supabase
    );

    if (!routeDecision) {
      await supabase
        .from('payment_sessions')
        .update({ status: 'failed' })
        .eq('id', sessionId);

      return new Response(
        JSON.stringify({ error: 'No PSP configured for this tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store token
    const { data: token } = await supabase
      .from('tokens')
      .insert({
        tenant_id: tenantId,
        customer_email: session.customer_email,
        vault_provider: body.token_provider,
        vault_token_id: body.token_id,
      })
      .select()
      .single();

    // Generate idempotency key for PSP
    const idempotencyKey = `${sessionId}_${Date.now()}`;

    // Create payment attempt record
    const { data: attempt } = await supabase
      .from('payment_attempts')
      .insert({
        session_id: sessionId,
        tenant_id: tenantId,
        token_id: token?.id,
        psp: routeDecision.psp,
        idempotency_key: idempotencyKey,
        amount: session.amount,
        currency: session.currency,
        status: 'pending',
      })
      .select()
      .single();

    // Get adapter for selected PSP
    const adapter = adapters[routeDecision.psp];
    if (!adapter) {
      await supabase
        .from('payment_attempts')
        .update({
          status: 'failed',
          failure_code: 'adapter_not_found',
          failure_message: `No adapter for PSP: ${routeDecision.psp}`,
        })
        .eq('id', attempt?.id);

      await supabase
        .from('payment_sessions')
        .update({ status: 'failed' })
        .eq('id', sessionId);

      return new Response(
        JSON.stringify({ error: `PSP ${routeDecision.psp} not yet supported` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process payment
    const result = await adapter.authorize(
      {
        amount: session.amount,
        currency: session.currency,
        tokenId: body.token_id,
        idempotencyKey,
        capture: session.capture_method === 'automatic',
        customerEmail: session.customer_email,
        metadata: session.metadata,
      },
      routeDecision.credentials as { secret_key: string },
      basisTheoryApiKey
    );

    // Update attempt with result
    await supabase
      .from('payment_attempts')
      .update({
        status: result.status,
        psp_transaction_id: result.transactionId,
        failure_code: result.failureCode,
        failure_message: result.failureMessage,
        raw_response: result.rawResponse,
      })
      .eq('id', attempt?.id);

    // Update token with card details if available
    if (result.card) {
      await supabase
        .from('tokens')
        .update({
          card_brand: result.card.brand,
          card_last4: result.card.last4,
          card_exp_month: result.card.exp_month,
          card_exp_year: result.card.exp_year,
        })
        .eq('id', token?.id);
    }

    // Update session status
    const sessionStatus = result.success
      ? result.status === 'captured'
        ? 'succeeded'
        : 'processing' // authorized but not captured
      : 'failed';

    await supabase
      .from('payment_sessions')
      .update({ status: sessionStatus })
      .eq('id', sessionId);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: result.failureMessage || 'Payment failed',
          code: result.failureCode,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return payment details
    return new Response(
      JSON.stringify({
        id: attempt?.id,
        session_id: sessionId,
        amount: session.amount,
        currency: session.currency,
        status: result.status,
        psp: routeDecision.psp,
        psp_transaction_id: result.transactionId,
        card: result.card,
        created_at: attempt?.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
