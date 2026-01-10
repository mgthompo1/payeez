/**
 * API Card Collection Proxy Edge Function
 *
 * This endpoint allows merchants to receive card data via API/webhooks
 * while staying PCI compliant. The proxy intercepts incoming requests,
 * tokenizes card data, and forwards the tokenized version to the
 * merchant's endpoint.
 *
 * Use Cases:
 * - B2B partner integrations
 * - AI agent payments
 * - Webhook-based card collection
 * - Legacy system integrations
 *
 * Supported Content Types:
 * - application/json
 * - application/xml
 * - application/x-www-form-urlencoded
 *
 * Flow:
 * 1. Partner sends card data to Atlas proxy URL
 * 2. Proxy extracts card data based on configured field path
 * 3. Card data is tokenized via Basis Theory
 * 4. Tokenized request is forwarded to merchant's destination URL
 * 5. Merchant receives token ID instead of raw card data
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, bt-proxy-key',
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface ProxyConfig {
  id: string;
  merchant_id: string;
  destination_url: string;
  card_field_path: string;
  require_auth: boolean;
  auth_type: string;
  auth_config: any;
  enabled: boolean;
  rate_limit_per_minute: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const proxyKey = req.headers.get('BT-PROXY-KEY') || url.searchParams.get('bt-proxy-key');

  if (!proxyKey) {
    return new Response(
      JSON.stringify({ error: 'Missing proxy key' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const btApiKey = Deno.env.get('BASIS_THEORY_PRIVATE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get proxy configuration
    const { data: proxyConfig, error: configError } = await supabase
      .from('card_collection_proxies')
      .select('*')
      .eq('proxy_key', proxyKey)
      .eq('enabled', true)
      .single();

    if (configError || !proxyConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid or disabled proxy' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Rate limiting check
    const rateLimitOk = await checkRateLimit(supabase, proxyConfig.id, proxyConfig.rate_limit_per_minute);
    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Authentication (if required)
    if (proxyConfig.require_auth) {
      const authResult = await authenticateRequest(req, proxyConfig);
      if (!authResult.success) {
        return new Response(
          JSON.stringify({ error: authResult.error }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Get content type
    const contentType = req.headers.get('Content-Type') || 'application/json';

    // Parse and tokenize request body
    const rawBody = await req.text();
    const { tokenizedBody, tokenIntentId } = await tokenizeRequestBody(
      rawBody,
      contentType,
      proxyConfig.card_field_path,
      btApiKey
    );

    // Record token intent
    await supabase.from('proxy_token_intents').insert({
      proxy_id: proxyConfig.id,
      merchant_id: proxyConfig.merchant_id,
      token_intent_id: tokenIntentId,
      source_ip: req.headers.get('X-Forwarded-For') || 'unknown',
      content_type: contentType,
    });

    // Forward to destination
    const forwardHeaders = new Headers();
    req.headers.forEach((value, key) => {
      // Don't forward auth or proxy headers
      if (!['authorization', 'bt-proxy-key', 'host'].includes(key.toLowerCase())) {
        forwardHeaders.set(key, value);
      }
    });
    forwardHeaders.set('Content-Type', contentType);
    forwardHeaders.set('X-Atlas-Token-Intent', tokenIntentId);

    const destinationResponse = await fetch(proxyConfig.destination_url, {
      method: req.method,
      headers: forwardHeaders,
      body: tokenizedBody,
    });

    // Update proxy stats
    await supabase
      .from('card_collection_proxies')
      .update({
        total_requests: proxyConfig.total_requests + 1,
        successful_requests: destinationResponse.ok
          ? proxyConfig.successful_requests + 1
          : proxyConfig.successful_requests,
        failed_requests: !destinationResponse.ok
          ? proxyConfig.failed_requests + 1
          : proxyConfig.failed_requests,
        last_request_at: new Date().toISOString(),
      })
      .eq('id', proxyConfig.id);

    // Return destination response
    const responseBody = await destinationResponse.text();
    const responseHeaders = new Headers(corsHeaders);
    destinationResponse.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(responseBody, {
      status: destinationResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Card Collection Proxy Error:', error);
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
 * Tokenize card data in request body
 */
async function tokenizeRequestBody(
  body: string,
  contentType: string,
  cardFieldPath: string,
  btApiKey: string
): Promise<{ tokenizedBody: string; tokenIntentId: string }> {
  if (contentType.includes('application/json')) {
    return tokenizeJsonBody(body, cardFieldPath, btApiKey);
  } else if (contentType.includes('application/xml')) {
    return tokenizeXmlBody(body, cardFieldPath, btApiKey);
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    return tokenizeFormBody(body, cardFieldPath, btApiKey);
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}

/**
 * Tokenize JSON body
 */
async function tokenizeJsonBody(
  body: string,
  cardFieldPath: string,
  btApiKey: string
): Promise<{ tokenizedBody: string; tokenIntentId: string }> {
  const parsed = JSON.parse(body);

  // Extract card data from specified path
  const cardData = getNestedValue(parsed, cardFieldPath);

  if (!cardData || !cardData.number) {
    throw new Error(`Card data not found at path: ${cardFieldPath}`);
  }

  // Create token intent via Basis Theory
  const tokenIntent = await createTokenIntent(cardData, btApiKey);

  // Replace card data with token intent
  setNestedValue(parsed, cardFieldPath, {
    token_intent_id: tokenIntent.id,
    type: 'token_intent',
  });

  return {
    tokenizedBody: JSON.stringify(parsed),
    tokenIntentId: tokenIntent.id,
  };
}

/**
 * Tokenize XML body
 */
async function tokenizeXmlBody(
  body: string,
  cardFieldPath: string,
  btApiKey: string
): Promise<{ tokenizedBody: string; tokenIntentId: string }> {
  // Simple XML parsing (in production, use a proper XML parser)
  const numberMatch = body.match(/<Number>(\d+)<\/Number>/);
  const expiryMonthMatch = body.match(/<ExpirationMonth>(\d+)<\/ExpirationMonth>/);
  const expiryYearMatch = body.match(/<ExpirationYear>(\d+)<\/ExpirationYear>/);
  const cvcMatch = body.match(/<Cvc>(\d+)<\/Cvc>/);

  if (!numberMatch) {
    throw new Error('Card number not found in XML');
  }

  const cardData = {
    number: numberMatch[1],
    expiration_month: parseInt(expiryMonthMatch?.[1] || '12'),
    expiration_year: parseInt(expiryYearMatch?.[1] || '2025'),
    cvc: cvcMatch?.[1] || '',
  };

  // Create token intent
  const tokenIntent = await createTokenIntent(cardData, btApiKey);

  // Replace card data with token in XML
  let tokenizedXml = body
    .replace(/<Number>\d+<\/Number>/, `<TokenIntentId>${tokenIntent.id}</TokenIntentId>`)
    .replace(/<ExpirationMonth>\d+<\/ExpirationMonth>/, '')
    .replace(/<ExpirationYear>\d+<\/ExpirationYear>/, '')
    .replace(/<Cvc>\d+<\/Cvc>/, '');

  return {
    tokenizedBody: tokenizedXml,
    tokenIntentId: tokenIntent.id,
  };
}

/**
 * Tokenize form-urlencoded body
 */
async function tokenizeFormBody(
  body: string,
  cardFieldPath: string,
  btApiKey: string
): Promise<{ tokenizedBody: string; tokenIntentId: string }> {
  const params = new URLSearchParams(body);

  const cardData = {
    number: params.get(`${cardFieldPath}[number]`) || params.get('card_number') || '',
    expiration_month: parseInt(params.get(`${cardFieldPath}[expiration_month]`) || params.get('expiration_month') || '12'),
    expiration_year: parseInt(params.get(`${cardFieldPath}[expiration_year]`) || params.get('expiration_year') || '2025'),
    cvc: params.get(`${cardFieldPath}[cvc]`) || params.get('cvc') || '',
  };

  if (!cardData.number) {
    throw new Error('Card number not found in form data');
  }

  // Create token intent
  const tokenIntent = await createTokenIntent(cardData, btApiKey);

  // Remove card fields and add token
  params.delete(`${cardFieldPath}[number]`);
  params.delete(`${cardFieldPath}[expiration_month]`);
  params.delete(`${cardFieldPath}[expiration_year]`);
  params.delete(`${cardFieldPath}[cvc]`);
  params.delete('card_number');
  params.delete('expiration_month');
  params.delete('expiration_year');
  params.delete('cvc');
  params.set(`${cardFieldPath}[token_intent_id]`, tokenIntent.id);

  return {
    tokenizedBody: params.toString(),
    tokenIntentId: tokenIntent.id,
  };
}

/**
 * Create token intent via Basis Theory
 */
async function createTokenIntent(
  cardData: {
    number: string;
    expiration_month: number;
    expiration_year: number;
    cvc: string;
  },
  btApiKey: string
): Promise<{ id: string }> {
  const response = await fetch('https://api.basistheory.com/token-intents', {
    method: 'POST',
    headers: {
      'BT-API-KEY': btApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'card',
      data: {
        number: cardData.number,
        expiration_month: cardData.expiration_month,
        expiration_year: cardData.expiration_year,
        cvc: cardData.cvc,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create token intent: ${error.message || 'Unknown error'}`);
  }

  return response.json();
}

/**
 * Authenticate request based on proxy config
 */
async function authenticateRequest(
  req: Request,
  config: ProxyConfig
): Promise<{ success: boolean; error?: string }> {
  const authHeader = req.headers.get('Authorization');

  switch (config.auth_type) {
    case 'api_key':
      const expectedKey = config.auth_config?.api_key;
      if (!expectedKey) return { success: true }; // No key configured
      if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
        return { success: false, error: 'Invalid API key' };
      }
      return { success: true };

    case 'jwt':
      if (!authHeader?.startsWith('Bearer ')) {
        return { success: false, error: 'Missing JWT token' };
      }
      try {
        const token = authHeader.slice(7);
        const valid = await verifyJwt(token, config.auth_config || {});
        return valid ? { success: true } : { success: false, error: 'Invalid JWT token' };
      } catch (error) {
        console.error('JWT verification failed:', error);
        return { success: false, error: 'Invalid JWT token' };
      }

    default:
      return { success: true };
  }
}

/**
 * Check rate limit
 */
async function checkRateLimit(
  supabase: any,
  proxyId: string,
  limitPerMinute: number
): Promise<boolean> {
  // Simple rate limiting using recent request count
  // In production, use Redis or similar for distributed rate limiting
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  const { count } = await supabase
    .from('proxy_token_intents')
    .select('*', { count: 'exact', head: true })
    .eq('proxy_id', proxyId)
    .gte('created_at', oneMinuteAgo);

  return (count || 0) < limitPerMinute;
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested value in object
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

function decodeBase64Url(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseJwtSection<T>(input: string): T {
  const bytes = decodeBase64Url(input);
  return JSON.parse(textDecoder.decode(bytes)) as T;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return decodeBase64Url(cleaned).buffer;
}

async function verifyJwt(
  token: string,
  config: {
    jwt_secret?: string;
    secret?: string;
    jwt_public_key?: string;
    public_key?: string;
    public_key_pem?: string;
    algorithm?: 'HS256' | 'RS256';
    issuer?: string;
    audience?: string | string[];
    leeway_seconds?: number;
  }
): Promise<boolean> {
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !signatureB64) {
    return false;
  }

  const header = parseJwtSection<{ alg?: string }>(headerB64);
  const payload = parseJwtSection<Record<string, unknown>>(payloadB64);
  const alg = header.alg;
  const expectedAlg = config.algorithm || alg;

  if (!alg || expectedAlg !== alg) {
    return false;
  }

  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = decodeBase64Url(signatureB64);

  if (alg === 'HS256') {
    const secret = config.jwt_secret || config.secret;
    if (!secret) return false;

    const key = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      textEncoder.encode(signingInput)
    );

    if (!verified) return false;
  } else if (alg === 'RS256') {
    const publicKey = config.jwt_public_key || config.public_key || config.public_key_pem;
    if (!publicKey) return false;

    const key = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature,
      textEncoder.encode(signingInput)
    );

    if (!verified) return false;
  } else {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const leeway = config.leeway_seconds ?? 0;
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : undefined;
  const iss = typeof payload.iss === 'string' ? payload.iss : undefined;
  const aud = payload.aud;

  if (exp && now > exp + leeway) return false;
  if (nbf && now < nbf - leeway) return false;
  if (config.issuer && iss && iss !== config.issuer) return false;

  if (config.audience) {
    const allowed = Array.isArray(config.audience) ? config.audience : [config.audience];
    if (typeof aud === 'string') {
      if (!allowed.includes(aud)) return false;
    } else if (Array.isArray(aud)) {
      const hasMatch = aud.some((value) => allowed.includes(value));
      if (!hasMatch) return false;
    } else {
      return false;
    }
  }

  return true;
}
