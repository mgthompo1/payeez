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
import { windcaveAdapter } from '../_shared/adapters/windcave.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RefundRequest {
  amount?: number;
  reason?: string;
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

    if (!paymentId || paymentId === 'refund-payment') {
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

    const body: RefundRequest = await req.json().catch(() => ({}));
    if (body.amount !== undefined && (!Number.isInteger(body.amount) || body.amount <= 0)) {
      return new Response(
        JSON.stringify({ error: 'amount must be a positive integer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const idempotencyKey = req.headers.get('idempotency-key')
      || req.headers.get('x-idempotency-key')
      || crypto.randomUUID();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key')) {
      const { data: existingRefund } = await supabase
        .from('refunds')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (existingRefund) {
        return new Response(
          JSON.stringify({
            id: existingRefund.id,
            payment_id: existingRefund.payment_attempt_id,
            amount: existingRefund.amount,
            currency: existingRefund.currency,
            status: existingRefund.status,
            reason: existingRefund.reason,
            created_at: existingRefund.created_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: attempt, error } = await supabase
      .from('payment_attempts')
      .select('id, session_id, tenant_id, psp, psp_transaction_id, amount, currency, status, captured_amount, refunded_amount')
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

    if (attempt.status !== 'captured' && attempt.status !== 'refunded') {
      return new Response(
        JSON.stringify({ error: `Cannot refund payment in status: ${attempt.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const capturedAmount = attempt.captured_amount ?? 0;
    const normalizedCapturedAmount = capturedAmount > 0 || attempt.status !== 'captured'
      ? capturedAmount
      : attempt.amount;
    const refundedAmount = attempt.refunded_amount ?? 0;
    const refundableAmount = Math.max(0, normalizedCapturedAmount - refundedAmount);

    if (refundableAmount === 0) {
      return new Response(
        JSON.stringify({ error: 'No refundable amount remaining' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const refundAmount = body.amount ?? refundableAmount;
    if (refundAmount > refundableAmount) {
      return new Response(
        JSON.stringify({ error: 'Refund amount exceeds captured amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adapter = adapters[attempt.psp];
    if (!adapter?.refund) {
      return new Response(
        JSON.stringify({ error: `No refund adapter for PSP: ${attempt.psp}` }),
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

    const result = await refundWithAdapter(
      attempt.psp,
      adapter,
      attempt.psp_transaction_id,
      refundAmount,
      attempt.currency,
      credentials,
      idempotencyKey
    );

    const refundStatus = result.success ? 'succeeded' : 'failed';

    const { data: refundRecord, error: refundError } = await supabase
      .from('refunds')
      .insert({
        payment_attempt_id: attempt.id,
        session_id: attempt.session_id,
        tenant_id: auth.tenantId,
        psp: attempt.psp,
        psp_refund_id: result.transactionId || null,
        amount: refundAmount,
        currency: attempt.currency,
        status: refundStatus,
        reason: body.reason,
        idempotency_key: idempotencyKey,
        raw_response: result.rawResponse,
      })
      .select()
      .single();

    if (refundError) {
      console.error('Failed to record refund:', refundError);
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: result.failureMessage || 'Refund failed',
          code: result.failureCode || 'refund_failed',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newRefundedAmount = refundedAmount + refundAmount;
    const fullyRefunded = newRefundedAmount >= normalizedCapturedAmount && normalizedCapturedAmount > 0;

    await supabase
      .from('payment_attempts')
      .update({
        status: fullyRefunded ? 'refunded' : 'captured',
        refunded_amount: newRefundedAmount,
      })
      .eq('id', attempt.id);

    if (fullyRefunded) {
      await supabase
        .from('payment_sessions')
        .update({ status: 'refunded' })
        .eq('id', attempt.session_id);
    }

    return new Response(
      JSON.stringify({
        id: refundRecord?.id,
        payment_id: refundRecord?.payment_attempt_id || attempt.id,
        amount: refundRecord?.amount || refundAmount,
        currency: refundRecord?.currency || attempt.currency,
        status: refundRecord?.status || refundStatus,
        reason: refundRecord?.reason || body.reason,
        created_at: refundRecord?.created_at || new Date().toISOString(),
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

async function refundWithAdapter(
  psp: string,
  adapter: typeof stripeAdapter,
  transactionId: string,
  amount: number,
  currency: string,
  credentials: Record<string, unknown>,
  idempotencyKey: string
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
      return await adapter.refund(
        transactionId,
        amount,
        credentials as { secret_key: string },
        idempotencyKey
      );
    case 'adyen':
    case 'dlocal':
    case 'checkoutcom':
    case 'airwallex':
      return await adapter.refund(
        transactionId,
        amount,
        currency,
        credentials as any,
        idempotencyKey
      );
    case 'nuvei':
      return await adapter.refund(transactionId, amount, currency, credentials as any);
    case 'authorizenet':
    case 'chase':
    case 'braintree':
      return await adapter.refund(transactionId, amount, credentials as any);
    default:
      return {
        success: false,
        transactionId,
        status: 'failed',
        failureCode: 'unsupported_psp',
        failureMessage: `Refund not supported for PSP: ${psp}`,
      };
  }
}
