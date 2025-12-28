import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiKey, generateSecureToken } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateSessionRequest {
  amount: number;
  currency: string;
  external_id?: string;
  payment_method_types?: string[];
  customer?: {
    email?: string;
    name?: string;
  };
  capture_method?: 'automatic' | 'manual';
  success_url?: string;
  cancel_url?: string;
  metadata?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate API key
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

    // Parse request body
    const body: CreateSessionRequest = await req.json();

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'amount is required and must be positive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.currency) {
      return new Response(
        JSON.stringify({ error: 'currency is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get idempotency key
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      // Check for existing session with this idempotency key
      const { data: existing } = await supabase
        .from('payment_sessions')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('external_id', idempotencyKey)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({
            id: existing.id,
            client_secret: existing.client_secret,
            status: existing.status,
            amount: existing.amount,
            currency: existing.currency,
            external_id: existing.external_id,
            fallback_url: existing.fallback_url,
            created_at: existing.created_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate client secret
    const clientSecret = generateSecureToken('cs_', 48);

    // Create payment session
    const { data: session, error } = await supabase
      .from('payment_sessions')
      .insert({
        tenant_id: auth.tenantId,
        external_id: body.external_id || idempotencyKey,
        client_secret: clientSecret,
        amount: body.amount,
        currency: body.currency.toUpperCase(),
        status: 'requires_payment_method',
        capture_method: body.capture_method || 'automatic',
        payment_method_types: body.payment_method_types,
        customer_email: body.customer?.email,
        customer_name: body.customer?.name,
        metadata: body.metadata || {},
        success_url: body.success_url,
        cancel_url: body.cancel_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        id: session.id,
        client_secret: session.client_secret,
        status: session.status,
        amount: session.amount,
        currency: session.currency,
        external_id: session.external_id,
        fallback_url: session.fallback_url,
        created_at: session.created_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
