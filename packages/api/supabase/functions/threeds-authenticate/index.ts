/**
 * 3D Secure Authentication Edge Function
 *
 * This endpoint handles 3DS authentication for card payments.
 * It integrates with Basis Theory's Universal 3DS service.
 *
 * Flow:
 * 1. Receive authentication request with token ID and amount
 * 2. Call Basis Theory 3DS API to initiate authentication
 * 3. Return either frictionless result or challenge URL
 *
 * Endpoints:
 * - POST /v1/3ds/authenticate - Initiate 3DS authentication
 * - GET /v1/3ds/sessions/:id/result - Get authentication result
 * - POST /v1/3ds/sessions/:id/challenge-complete - Complete challenge
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateClientSecret } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthenticateRequest {
  session_id: string;
  token_id: string;
  amount: number;
  currency: string;
  challenge_preference?: 'no_preference' | 'no_challenge' | 'challenge_requested' | 'challenge_mandated';
}

interface ThreeDSSession {
  id: string;
  status: string;
  challenge_required: boolean;
  challenge_url?: string;
  authentication_value?: string;
  eci?: string;
  ds_transaction_id?: string;
  acs_transaction_id?: string;
  authentication_status?: string;
  liability_shift?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const isAuthPath = path.endsWith('/threeds-authenticate') || path.endsWith('/v1/3ds/authenticate');
  const resultMatch = path.match(/\/threeds-authenticate\/sessions\/([\w-]+)\/result$/)
    || path.match(/\/v1\/3ds\/sessions\/([\w-]+)\/result$/);
  const challengeMatch = path.match(/\/threeds-authenticate\/sessions\/([\w-]+)\/challenge-complete$/)
    || path.match(/\/v1\/3ds\/sessions\/([\w-]+)\/challenge-complete$/);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const btApiKey = Deno.env.get('BASIS_THEORY_PRIVATE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Route handling
    if (isAuthPath && req.method === 'POST') {
      return await handleAuthenticate(req, supabase, btApiKey, supabaseUrl, supabaseKey);
    }

    if (resultMatch && req.method === 'GET') {
      const sessionId = resultMatch[1];
      return await handleGetResult(sessionId, req, supabase, supabaseUrl, supabaseKey);
    }

    if (challengeMatch && req.method === 'POST') {
      const sessionId = challengeMatch[1];
      return await handleChallengeComplete(sessionId, req, supabase, btApiKey, supabaseUrl, supabaseKey);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('3DS Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Initiate 3DS authentication
 */
async function handleAuthenticate(
  req: Request,
  supabase: any,
  btApiKey: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body: AuthenticateRequest = await req.json();
  const { session_id, token_id, amount, currency, challenge_preference } = body;

  const clientSecret = authHeader.slice(7);
  const auth = await authenticateClientSecret(session_id, clientSecret, supabaseUrl, supabaseKey);

  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session or client secret' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { tenantId, session: paymentSession } = auth;

  // Get 3DS config for the tenant
  const { data: threeDSConfig } = await supabase
    .from('threeds_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .limit(1)
    .single();

  // Get card brand from token
  const tokenResponse = await fetch(`https://api.basistheory.com/tokens/${token_id}`, {
    headers: { 'BT-API-KEY': btApiKey },
  });
  const tokenData = await tokenResponse.json();
  const cardBrand = detectCardBrand(tokenData.data?.number);

  // Call Basis Theory 3DS API
  const threeDSResponse = await fetch('https://api.basistheory.com/3ds/sessions', {
    method: 'POST',
    headers: {
      'BT-API-KEY': btApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token_id,
      type: 'customer', // Customer-initiated transaction
      purchase_info: {
        amount: amount.toString(),
        currency: currency.toUpperCase(),
        exponent: 2,
        date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      },
      merchant_info: {
        mid: threeDSConfig?.acquirer_merchant_ids?.[cardBrand] || 'default_mid',
        acquirer_bin: threeDSConfig?.acquirer_bins?.[cardBrand] || '000000',
        name: threeDSConfig?.merchant_name || 'Merchant',
        category_code: threeDSConfig?.merchant_category_code || '5999',
        country_code: threeDSConfig?.merchant_country_code || '840',
        url: threeDSConfig?.merchant_url,
      },
      requestor_info: {
        id: Deno.env.get('ATLAS_3DS_REQUESTOR_ID'),
        name: 'Atlas',
        url: 'https://atlas.co',
      },
      device_info: {
        browser_javascript_enabled: true,
        browser_java_enabled: false,
        browser_language: 'en-US',
        browser_color_depth: '24',
        browser_screen_height: '1080',
        browser_screen_width: '1920',
        browser_tz: '-300',
        browser_user_agent: req.headers.get('User-Agent') || 'Unknown',
        browser_accept_header: req.headers.get('Accept') || '*/*',
      },
      challenge_preference: challenge_preference || 'no_preference',
    }),
  });

  if (!threeDSResponse.ok) {
    const errorData = await threeDSResponse.json();
    console.error('Basis Theory 3DS error:', errorData);
    return new Response(
      JSON.stringify({ error: 'Failed to initiate 3DS authentication' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const threeDSData = await threeDSResponse.json();

  // Create 3DS session in database
  const { data: threeDSSession, error: insertError } = await supabase
    .from('threeds_sessions')
    .insert({
      tenant_id: tenantId,
      payment_session_id: session_id,
      token_id,
      card_brand: cardBrand,
      threeds_version: '2.2.0',
      status: threeDSData.status === 'complete' ? 'authenticated' : 'challenge_required',
      amount,
      currency,
      authentication_value: threeDSData.authentication_value,
      eci: threeDSData.eci,
      ds_transaction_id: threeDSData.ds_transaction_id,
      acs_transaction_id: threeDSData.acs_transaction_id,
      threeds_server_transaction_id: threeDSData.id,
      challenge_required: threeDSData.status === 'challenge',
      challenge_url: threeDSData.challenge_url,
      authentication_status: threeDSData.authentication_status,
      liability_shift: threeDSData.authentication_status === 'Y',
      raw_response: threeDSData,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to save 3DS session:', insertError);
  }

  // Update payment session with 3DS reference
  await supabase
    .from('payment_sessions')
    .update({
      threeds_session_id: threeDSSession?.id,
      threeds_required: true,
    })
    .eq('id', session_id);

  const response: ThreeDSSession = {
    id: threeDSSession?.id || threeDSData.id,
    status: threeDSData.authentication_status || 'pending',
    challenge_required: threeDSData.status === 'challenge',
    challenge_url: threeDSData.challenge_url,
    authentication_value: threeDSData.authentication_value,
    eci: threeDSData.eci,
    ds_transaction_id: threeDSData.ds_transaction_id,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Get 3DS authentication result
 */
async function handleGetResult(
  sessionId: string,
  req: Request,
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string
): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: session, error } = await supabase
    .from('threeds_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = await authenticateClientSecret(
    session.payment_session_id,
    authHeader.slice(7),
    supabaseUrl,
    supabaseKey
  );

  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session or client secret' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      status: session.authentication_status,
      authentication_value: session.authentication_value,
      eci: session.eci,
      ds_transaction_id: session.ds_transaction_id,
      liability_shift: session.liability_shift,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Handle challenge completion
 */
async function handleChallengeComplete(
  sessionId: string,
  req: Request,
  supabase: any,
  btApiKey: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get the session
  const { data: session } = await supabase
    .from('threeds_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const clientSecret = authHeader.slice(7);
  const auth = await authenticateClientSecret(
    session.payment_session_id,
    clientSecret,
    supabaseUrl,
    supabaseKey
  );

  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session or client secret' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get the result from Basis Theory
  const btResponse = await fetch(
    `https://api.basistheory.com/3ds/sessions/${session.threeds_server_transaction_id}/result`,
    {
      headers: { 'BT-API-KEY': btApiKey },
    }
  );

  const btResult = await btResponse.json();

  // Update the session
  await supabase
    .from('threeds_sessions')
    .update({
      status: btResult.authentication_status === 'Y' ? 'authenticated' : 'failed',
      authentication_value: btResult.authentication_value,
      eci: btResult.eci,
      authentication_status: btResult.authentication_status,
      liability_shift: btResult.authentication_status === 'Y',
      challenge_completed: true,
      authenticated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  // Update payment session
  await supabase
    .from('payment_sessions')
    .update({
      threeds_authenticated: btResult.authentication_status === 'Y',
    })
    .eq('threeds_session_id', sessionId);

  return new Response(
    JSON.stringify({
      status: btResult.authentication_status,
      authentication_value: btResult.authentication_value,
      eci: btResult.eci,
      ds_transaction_id: btResult.ds_transaction_id,
      liability_shift: btResult.authentication_status === 'Y',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Detect card brand from card number
 */
function detectCardBrand(cardNumber?: string): string {
  if (!cardNumber) return 'unknown';

  const patterns: Record<string, RegExp> = {
    visa: /^4/,
    mastercard: /^5[1-5]|^2[2-7]/,
    amex: /^3[47]/,
    discover: /^6(?:011|5)/,
    jcb: /^35/,
  };

  for (const [brand, pattern] of Object.entries(patterns)) {
    if (pattern.test(cardNumber)) {
      return brand;
    }
  }

  return 'unknown';
}
