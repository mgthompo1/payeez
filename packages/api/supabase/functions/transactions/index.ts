/**
 * Fallback Transactions Sync Edge Function
 *
 * Records fallback PSP transactions for later reconciliation.
 * Endpoint: POST /transactions/sync
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateClientSecret } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SyncRequest {
  session_id: string;
  route: string;
  data: {
    amount?: number;
    currency?: string;
    psp?: string;
    result?: {
      id?: string;
      transactionId?: string;
      status?: string;
    };
    [key: string]: unknown;
  };
  timestamp?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const isSync = path.endsWith('/transactions/sync') || path.endsWith('/v1/transactions/sync');

  if (!isSync || req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: SyncRequest = await req.json();
    const { session_id, route, data } = body;

    if (!session_id || !route || !data) {
      return new Response(JSON.stringify({ error: 'session_id, route, and data are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = await authenticateClientSecret(session_id, authHeader.slice(7), supabaseUrl, supabaseKey);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Invalid session or client secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amount = data.amount;
    const currency = data.currency;
    const psp = data.psp;

    if (!amount || !currency || !psp) {
      return new Response(JSON.stringify({ error: 'amount, currency, and psp are required in data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = data.result || {};
    const pspTransactionId = result.id || result.transactionId || null;

    const { error } = await supabase
      .from('fallback_transactions')
      .insert({
        tenant_id: auth.tenantId,
        payment_session_id: session_id,
        fallback_route: route,
        original_route: 'primary',
        amount,
        currency,
        psp,
        psp_transaction_id: pspTransactionId,
        status: result.status || 'unknown',
        metadata: data,
        created_at: body.timestamp || new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to record fallback transaction:', error);
      return new Response(JSON.stringify({ error: 'Failed to record transaction' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ synced: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Fallback sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
