/**
 * Apple Pay Merchant Validation Edge Function
 *
 * Validates the merchant session with Apple Pay during checkout.
 * Expects a client secret in Authorization header.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateClientSecret } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ValidateMerchantRequest {
  validation_url: string;
  domain: string;
  session_id: string;
}

function normalizePem(input: string | null): string | null {
  if (!input) return null;
  const normalized = input.replace(/\\n/g, '\n').trim();
  if (normalized.includes('-----BEGIN')) return normalized;
  const trimmed = normalized.trim();
  try {
    const decoded = atob(trimmed);
    return decoded.includes('-----BEGIN') ? decoded : decoded;
  } catch {
    return normalized;
  }
}

function isAllowedValidationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const hostAllowed = [
      'apple-pay-gateway.apple.com',
      'apple-pay-gateway-cert.apple.com',
    ].includes(parsed.hostname);
    return hostAllowed && parsed.pathname.includes('/paymentservices/startSession');
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
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

    const body: ValidateMerchantRequest = await req.json();
    const { validation_url, domain, session_id } = body;

    if (!validation_url || !domain || !session_id) {
      return new Response(JSON.stringify({ error: 'validation_url, domain, and session_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isAllowedValidationUrl(validation_url)) {
      return new Response(JSON.stringify({ error: 'Invalid validation URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientSecret = authHeader.slice(7);
    const auth = await authenticateClientSecret(session_id, clientSecret, supabaseUrl, supabaseKey);

    if (!auth) {
      return new Response(JSON.stringify({ error: 'Invalid session or client secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tenantId } = auth;

    const { data: tenant } = await supabase
      .from('tenants')
      .select('environment')
      .eq('id', tenantId)
      .single();

    const { data: paymentConfig } = await supabase
      .from('payment_method_configs')
      .select('apple_pay_merchant_id, apple_pay_merchant_name, apple_pay_merchant_cert_encrypted, apple_pay_merchant_key_encrypted')
      .eq('tenant_id', tenantId)
      .eq('environment', tenant?.environment || 'test')
      .single();

    const merchantId = paymentConfig?.apple_pay_merchant_id || Deno.env.get('APPLE_PAY_MERCHANT_ID');
    const merchantName = paymentConfig?.apple_pay_merchant_name || 'Payeez';
    const certPem = normalizePem(paymentConfig?.apple_pay_merchant_cert_encrypted || Deno.env.get('APPLE_PAY_MERCHANT_CERT'));
    const keyPem = normalizePem(paymentConfig?.apple_pay_merchant_key_encrypted || Deno.env.get('APPLE_PAY_MERCHANT_KEY'));

    if (!merchantId || !certPem || !keyPem) {
      return new Response(JSON.stringify({ error: 'Apple Pay merchant credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = Deno.createHttpClient({
      certChain: certPem,
      privateKey: keyPem,
    });

    try {
      const payload = {
        merchantIdentifier: merchantId,
        displayName: merchantName,
        initiative: 'web',
        initiativeContext: domain,
      };

      const response = await fetch(validation_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        client,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return new Response(
          JSON.stringify({ error: 'Apple Pay validation failed', details: errorBody }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sessionData = await response.text();
      return new Response(sessionData, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      client.close();
    }
  } catch (error) {
    console.error('Apple Pay validation error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
