import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateClientSecret } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Extract session ID from URL path
    // Expected: /get-session-config/{session_id}
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[pathParts.length - 1];

    if (!sessionId || sessionId === 'get-session-config') {
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

    const { session } = auth;

    // Check session status
    if (session.status === 'succeeded') {
      return new Response(
        JSON.stringify({ error: 'Session already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.status === 'canceled' || session.status === 'failed') {
      return new Response(
        JSON.stringify({ error: `Session ${session.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant configuration including vault provider
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tenant } = await supabase
      .from('tenants')
      .select('basis_theory_public_key, environment, vault_provider')
      .eq('id', auth.tenantId)
      .single();

    // Get payment method configuration for this tenant
    const { data: paymentMethodConfig } = await supabase
      .from('payment_method_configs')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('environment', tenant?.environment || 'test')
      .single();

    // Determine vault provider (default to 'atlas' if not configured)
    // Valid providers: 'atlas' (native), 'basis_theory', 'vgs'
    const vaultProvider = tenant?.vault_provider || 'atlas';

    // Determine available payment methods from session or tenant config
    const sessionPaymentMethods = session.payment_method_types || [];
    const availablePaymentMethods: string[] = [];

    // Check enabled payment methods
    if (!paymentMethodConfig || paymentMethodConfig.card_enabled) {
      availablePaymentMethods.push('card');
    }
    if (paymentMethodConfig?.apple_pay_enabled) {
      availablePaymentMethods.push('apple_pay');
    }
    if (paymentMethodConfig?.google_pay_enabled) {
      availablePaymentMethods.push('google_pay');
    }
    if (paymentMethodConfig?.bank_account_enabled) {
      availablePaymentMethods.push('bank_account');
    }

    // Use session-specified methods if provided, otherwise use tenant config
    const paymentMethods = sessionPaymentMethods.length > 0
      ? sessionPaymentMethods.filter((m: string) => availablePaymentMethods.includes(m))
      : availablePaymentMethods;

    // Build response config with actual vault provider
    const responseConfig: Record<string, any> = {
      session_id: session.id,
      client_secret: session.client_secret,
      amount: session.amount,
      currency: session.currency,
      capture_provider: vaultProvider,
      fallback_url: session.fallback_url,
      payment_methods: paymentMethods,
      // Environment for proper SDK configuration
      environment: tenant?.environment || 'test',
    };

    // Add provider-specific configuration
    if (vaultProvider === 'basis_theory') {
      responseConfig.basis_theory_key = tenant?.basis_theory_public_key || Deno.env.get('BASIS_THEORY_PUBLIC_KEY');
    } else if (vaultProvider === 'atlas') {
      // Atlas native vault - SDK will use the tokenize endpoint
      responseConfig.tokenize_url = `${Deno.env.get('ATLAS_ELEMENTS_URL') || 'https://elements.atlas.io'}/api/tokenize`;
    } else if (vaultProvider === 'vgs') {
      responseConfig.vgs_vault_id = Deno.env.get('VGS_VAULT_ID');
    }

    // Add Apple Pay config if enabled
    if (paymentMethods.includes('apple_pay') && paymentMethodConfig) {
      responseConfig.apple_pay = {
        merchant_id: paymentMethodConfig.apple_pay_merchant_id,
        merchant_name: paymentMethodConfig.apple_pay_merchant_name,
        country_code: 'US', // Could be made configurable
        supported_networks: paymentMethodConfig.apple_pay_supported_networks || ['visa', 'mastercard', 'amex'],
      };
    }

    // Add Google Pay config if enabled
    if (paymentMethods.includes('google_pay') && paymentMethodConfig) {
      responseConfig.google_pay = {
        merchant_id: paymentMethodConfig.google_pay_merchant_id,
        merchant_name: paymentMethodConfig.google_pay_merchant_name,
        environment: paymentMethodConfig.google_pay_environment || 'TEST',
        allowed_card_networks: paymentMethodConfig.google_pay_allowed_networks || ['VISA', 'MASTERCARD', 'AMEX'],
      };
    }

    // Add bank account config if enabled
    if (paymentMethods.includes('bank_account') && paymentMethodConfig) {
      responseConfig.bank_account = {
        account_types: paymentMethodConfig.bank_account_types || ['checking', 'savings'],
      };
    }

    // Return config for SDK
    return new Response(
      JSON.stringify(responseConfig),
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
