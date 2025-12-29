import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey } from '../_shared/auth.ts';
import { fetchPSPCredentials } from '../_shared/psp.ts';
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CaptureRequest {
  amount?: number;
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const paymentId = pathParts[pathParts.length - 1];

    if (!paymentId || paymentId === 'capture-payment') {
      return new Response(
        JSON.stringify({ error: 'Payment ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const auth = await authenticateApiKey(
      req.headers.get('authorization'),
      supabaseUrl,
      supabaseServiceKey
    );

    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CaptureRequest = await req.json().catch(() => ({}));
    if (body.amount !== undefined && (!Number.isInteger(body.amount) || body.amount <= 0)) {
      return new Response(
        JSON.stringify({ error: 'amount must be a positive integer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: attempt, error } = await supabase
      .from('payment_attempts')
      .select('id, session_id, tenant_id, psp, psp_transaction_id, amount, currency, status, payment_method_type, captured_amount, refunded_amount, created_at')
      .eq('id', paymentId)
      .eq('tenant_id', auth.tenantId)
      .single();

    if (error || !attempt) {
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!attempt.psp_transaction_id) {
      return new Response(
        JSON.stringify({ error: 'Missing PSP transaction ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (attempt.status !== 'authorized' && attempt.status !== 'captured') {
      return new Response(
        JSON.stringify({ error: `Cannot capture payment in status: ${attempt.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const capturedAmount = attempt.captured_amount ?? 0;
    const normalizedCapturedAmount = capturedAmount > 0 || attempt.status !== 'captured'
      ? capturedAmount
      : attempt.amount;
    const remainingToCapture = Math.max(0, attempt.amount - normalizedCapturedAmount);

    if (remainingToCapture === 0) {
      return new Response(
        JSON.stringify({
          id: attempt.id,
          session_id: attempt.session_id,
          amount: attempt.amount,
          currency: attempt.currency,
          status: attempt.status,
          payment_method_type: attempt.payment_method_type,
          psp: attempt.psp,
          psp_transaction_id: attempt.psp_transaction_id,
          captured_amount: normalizedCapturedAmount,
          refunded_amount: attempt.refunded_amount ?? 0,
          created_at: attempt.created_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const captureAmount = body.amount ?? remainingToCapture;
    if (captureAmount > remainingToCapture) {
      return new Response(
        JSON.stringify({ error: 'Capture amount exceeds remaining authorized amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adapter = adapters[attempt.psp];
    if (!adapter?.capture) {
      return new Response(
        JSON.stringify({ error: `No capture adapter for PSP: ${attempt.psp}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = await fetchPSPCredentials(
      supabase,
      auth.tenantId,
      attempt.psp,
      auth.environment,
      { logErrors: true }
    );

    if (!credentials) {
      return new Response(
        JSON.stringify({ error: 'PSP credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await captureWithAdapter(
      attempt.psp,
      adapter,
      attempt.psp_transaction_id,
      captureAmount,
      attempt.currency,
      credentials
    );

    if (!result.success) {
      await supabase
        .from('payment_attempts')
        .update({
          failure_code: result.failureCode,
          failure_message: result.failureMessage,
          raw_response: result.rawResponse,
        })
        .eq('id', attempt.id);

      return new Response(
        JSON.stringify({
          error: result.failureMessage || 'Capture failed',
          code: result.failureCode || 'capture_failed',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newCapturedAmount = normalizedCapturedAmount + captureAmount;
    const newStatus = 'captured';

    await supabase
      .from('payment_attempts')
      .update({
        status: newStatus,
        psp_transaction_id: result.transactionId || attempt.psp_transaction_id,
        captured_amount: newCapturedAmount,
        failure_code: null,
        failure_message: null,
        raw_response: result.rawResponse,
      })
      .eq('id', attempt.id);

    if (newCapturedAmount >= attempt.amount) {
      await supabase
        .from('payment_sessions')
        .update({ status: 'succeeded' })
        .eq('id', attempt.session_id);
    }

    return new Response(
      JSON.stringify({
        id: attempt.id,
        session_id: attempt.session_id,
        amount: attempt.amount,
        currency: attempt.currency,
        status: newStatus,
        payment_method_type: attempt.payment_method_type,
        psp: attempt.psp,
        psp_transaction_id: result.transactionId || attempt.psp_transaction_id,
        captured_amount: newCapturedAmount,
        refunded_amount: attempt.refunded_amount ?? 0,
        created_at: attempt.created_at,
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

async function captureWithAdapter(
  psp: string,
  adapter: typeof stripeAdapter,
  transactionId: string,
  amount: number,
  currency: string,
  credentials: Record<string, unknown>
): Promise<{
  success: boolean;
  transactionId: string;
  status: string;
  failureCode?: string;
  failureMessage?: string;
  rawResponse?: unknown;
}> {
  switch (psp) {
    case 'stripe':
      return await adapter.capture(transactionId, credentials as { secret_key: string }, amount);
    case 'adyen':
    case 'dlocal':
    case 'nuvei':
    case 'checkoutcom':
    case 'airwallex':
      return await adapter.capture(transactionId, amount, currency, credentials as any);
    case 'authorizenet':
    case 'chase':
    case 'braintree':
      return await adapter.capture(transactionId, amount, credentials as any);
    default:
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: 'unsupported_psp',
        failureMessage: `Capture not supported for PSP: ${psp}`,
      };
  }
}
