/**
 * Network Tokens Edge Function
 *
 * This endpoint manages Network Token creation and cryptogram generation.
 * Network Tokens are dynamic substitutes for actual card numbers provided
 * by card networks (Visa, Mastercard, Amex) offering:
 * - Higher authorization rates (5-10% improvement)
 * - Lower interchange costs
 * - Automatic card lifecycle updates
 * - Enhanced fraud prevention
 *
 * Endpoints:
 * - POST /v1/network-tokens - Create network token for a card
 * - POST /v1/network-tokens/:id/cryptogram - Generate cryptogram for CIT
 * - GET /v1/network-tokens/:id - Get network token details
 * - DELETE /v1/network-tokens/:id - Delete network token
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateClientSecret } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateNetworkTokenRequest {
  session_id: string;
  token_id: string;
  request_cryptogram?: boolean;
}

interface NetworkTokenResponse {
  networkTokenId: string;
  network: string;
  status: string;
  tokenExpiryMonth: string;
  tokenExpiryYear: string;
  cryptogram?: string;
  cryptogramType?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const createMatch = path.endsWith('/network-tokens') || path.endsWith('/v1/network-tokens');
  const cryptogramMatch = path.match(/\/network-tokens\/([\w-]+)\/cryptogram$/)
    || path.match(/\/v1\/network-tokens\/([\w-]+)\/cryptogram$/);
  const getMatch = path.match(/\/network-tokens\/([\w-]+)$/)
    || path.match(/\/v1\/network-tokens\/([\w-]+)$/);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const btApiKey = Deno.env.get('BASIS_THEORY_PRIVATE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Route handling
    if (createMatch && req.method === 'POST') {
      return await handleCreateNetworkToken(req, supabase, btApiKey, supabaseUrl, supabaseKey);
    }

    if (cryptogramMatch && req.method === 'POST') {
      const tokenId = cryptogramMatch[1];
      return await handleGenerateCryptogram(tokenId, req, supabase, btApiKey, supabaseUrl, supabaseKey);
    }

    if (getMatch && req.method === 'GET') {
      const tokenId = getMatch[1];
      return await handleGetNetworkToken(tokenId, req, supabase, supabaseUrl, supabaseKey);
    }

    if (getMatch && req.method === 'DELETE') {
      const tokenId = getMatch[1];
      return await handleDeleteNetworkToken(tokenId, req, supabase, btApiKey, supabaseUrl, supabaseKey);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Network Token Error:', error);
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
 * Create a Network Token for a card
 */
async function handleCreateNetworkToken(
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

  const body: CreateNetworkTokenRequest = await req.json();
  const { session_id, token_id, request_cryptogram } = body;

  const clientSecret = authHeader.slice(7);
  const auth = await authenticateClientSecret(session_id, clientSecret, supabaseUrl, supabaseKey);

  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session or client secret' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { tenantId } = auth;

  // Check if network token already exists for this card
  const { data: existingToken } = await supabase
    .from('network_tokens')
    .select('*')
    .eq('card_token_id', token_id)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .single();

  if (existingToken) {
    // Return existing token, optionally with new cryptogram
    if (request_cryptogram) {
      const cryptogramResult = await generateCryptogramFromBT(
        existingToken.token_reference_id,
        btApiKey
      );

      // Update token with new cryptogram
      await supabase
        .from('network_tokens')
        .update({
          last_cryptogram: cryptogramResult.cryptogram,
          last_cryptogram_type: cryptogramResult.type,
          last_cryptogram_generated_at: new Date().toISOString(),
          cryptogram_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
        })
        .eq('id', existingToken.id);

      return new Response(
        JSON.stringify({
          networkTokenId: existingToken.id,
          network: existingToken.network,
          status: existingToken.status,
          tokenExpiryMonth: existingToken.token_expiry_month,
          tokenExpiryYear: existingToken.token_expiry_year,
          cryptogram: cryptogramResult.cryptogram,
          cryptogramType: cryptogramResult.type,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        networkTokenId: existingToken.id,
        network: existingToken.network,
        status: existingToken.status,
        tokenExpiryMonth: existingToken.token_expiry_month,
        tokenExpiryYear: existingToken.token_expiry_year,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Create network token via Basis Theory
  const btResponse = await fetch('https://api.basistheory.com/network-tokens', {
    method: 'POST',
    headers: {
      'BT-API-KEY': btApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token_id,
      // Additional options based on merchant config
    }),
  });

  if (!btResponse.ok) {
    const errorData = await btResponse.json();
    console.error('Basis Theory Network Token error:', errorData);
    return new Response(
      JSON.stringify({
        error: 'Failed to create network token',
        details: errorData.error?.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const btData = await btResponse.json();

  // Store network token in database
  const { data: networkToken, error: insertError } = await supabase
    .from('network_tokens')
    .insert({
      tenant_id: tenantId,
      card_token_id: token_id,
      network: btData.network,
      network_token: btData.network_token,
      token_reference_id: btData.id,
      token_requestor_id: btData.token_requestor_id,
      token_expiry_month: btData.expiration_month,
      token_expiry_year: btData.expiration_year,
      status: 'active',
      last_cryptogram: request_cryptogram ? btData.cryptogram : null,
      last_cryptogram_type: request_cryptogram ? btData.cryptogram_type : null,
      last_cryptogram_generated_at: request_cryptogram ? new Date().toISOString() : null,
      cryptogram_expires_at: request_cryptogram
        ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
        : null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to save network token:', insertError);
  }

  // Record lifecycle event
  if (networkToken) {
    await supabase.from('network_token_events').insert({
      network_token_id: networkToken.id,
      event_type: 'created',
      event_data: {
        network: btData.network,
        token_requestor_id: btData.token_requestor_id,
      },
    });
  }

  const response: NetworkTokenResponse = {
    networkTokenId: networkToken?.id || btData.id,
    network: btData.network,
    status: 'active',
    tokenExpiryMonth: btData.expiration_month,
    tokenExpiryYear: btData.expiration_year,
    cryptogram: request_cryptogram ? btData.cryptogram : undefined,
    cryptogramType: request_cryptogram ? btData.cryptogram_type : undefined,
  };

  return new Response(JSON.stringify(response), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Generate cryptogram for an existing network token
 */
async function handleGenerateCryptogram(
  networkTokenId: string,
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

  const body = await req.json().catch(() => ({}));
  const sessionId = body?.session_id;
  const auth = sessionId
    ? await authenticateClientSecret(sessionId, authHeader.slice(7), supabaseUrl, supabaseKey)
    : null;

  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session or client secret' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get network token
  const { data: networkToken, error } = await supabase
    .from('network_tokens')
    .select('*')
    .eq('id', networkTokenId)
    .eq('status', 'active')
    .single();

  if (error || !networkToken) {
    return new Response(JSON.stringify({ error: 'Network token not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate cryptogram via Basis Theory
  const cryptogramResult = await generateCryptogramFromBT(
    networkToken.token_reference_id,
    btApiKey
  );

  // Update token with new cryptogram
  await supabase
    .from('network_tokens')
    .update({
      last_cryptogram: cryptogramResult.cryptogram,
      last_cryptogram_type: cryptogramResult.type,
      last_cryptogram_generated_at: new Date().toISOString(),
      cryptogram_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .eq('id', networkTokenId);

  // Record event
  await supabase.from('network_token_events').insert({
    network_token_id: networkTokenId,
    event_type: 'cryptogram_generated',
    event_data: {
      cryptogram_type: cryptogramResult.type,
    },
  });

  return new Response(
    JSON.stringify({
      cryptogram: cryptogramResult.cryptogram,
      cryptogramType: cryptogramResult.type,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Get network token details
 */
async function handleGetNetworkToken(
  networkTokenId: string,
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

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  const auth = sessionId
    ? await authenticateClientSecret(sessionId, authHeader.slice(7), supabaseUrl, supabaseKey)
    : null;

  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session or client secret' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: networkToken, error } = await supabase
    .from('network_tokens')
    .select('*')
    .eq('id', networkTokenId)
    .single();

  if (error || !networkToken) {
    return new Response(JSON.stringify({ error: 'Network token not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      networkTokenId: networkToken.id,
      network: networkToken.network,
      status: networkToken.status,
      tokenExpiryMonth: networkToken.token_expiry_month,
      tokenExpiryYear: networkToken.token_expiry_year,
      createdAt: networkToken.created_at,
      lastUpdatedByNetwork: networkToken.last_updated_by_network_at,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Delete (suspend) a network token
 */
async function handleDeleteNetworkToken(
  networkTokenId: string,
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

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  const auth = sessionId
    ? await authenticateClientSecret(sessionId, authHeader.slice(7), supabaseUrl, supabaseKey)
    : null;

  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session or client secret' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get network token
  const { data: networkToken, error } = await supabase
    .from('network_tokens')
    .select('*')
    .eq('id', networkTokenId)
    .single();

  if (error || !networkToken) {
    return new Response(JSON.stringify({ error: 'Network token not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Delete from Basis Theory
  await fetch(
    `https://api.basistheory.com/network-tokens/${networkToken.token_reference_id}`,
    {
      method: 'DELETE',
      headers: { 'BT-API-KEY': btApiKey },
    }
  );

  // Update status in database
  await supabase
    .from('network_tokens')
    .update({ status: 'deleted' })
    .eq('id', networkTokenId);

  // Record event
  await supabase.from('network_token_events').insert({
    network_token_id: networkTokenId,
    event_type: 'deleted',
    event_data: {},
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Generate cryptogram from Basis Theory
 */
async function generateCryptogramFromBT(
  tokenReferenceId: string,
  btApiKey: string
): Promise<{ cryptogram: string; type: string }> {
  const response = await fetch(
    `https://api.basistheory.com/network-tokens/${tokenReferenceId}/cryptogram`,
    {
      method: 'POST',
      headers: {
        'BT-API-KEY': btApiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to generate cryptogram');
  }

  const data = await response.json();
  return {
    cryptogram: data.cryptogram,
    type: data.cryptogram_type || 'TAVV',
  };
}
