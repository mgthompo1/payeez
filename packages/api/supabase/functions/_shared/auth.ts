import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuthResult {
  tenantId: string;
  environment: 'test' | 'live';
  apiKeyId?: string;
}

/**
 * Get allowed origins from environment variable
 * Defaults to empty array (no origins allowed) if not set
 * Set PAYEEZ_ALLOWED_ORIGINS as comma-separated list: "https://app.example.com,https://checkout.example.com"
 */
function getAllowedOrigins(): string[] {
  const origins = Deno.env.get('PAYEEZ_ALLOWED_ORIGINS');
  if (!origins) {
    return [];
  }
  return origins.split(',').map(o => o.trim()).filter(Boolean);
}

/**
 * Validate and return CORS origin header
 * Only allows origins explicitly listed in PAYEEZ_ALLOWED_ORIGINS
 */
export function getCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;

  const allowedOrigins = getAllowedOrigins();

  // In development/testing, allow localhost if explicitly configured
  if (allowedOrigins.length === 0) {
    console.warn('[Security] PAYEEZ_ALLOWED_ORIGINS not configured - CORS will block requests');
    return null;
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Log blocked origin attempts for security monitoring
  console.warn(`[Security] CORS blocked origin: ${requestOrigin}`);
  return null;
}

/**
 * Build CORS headers for a specific request
 * Uses origin validation instead of wildcard
 */
export function buildCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOrigin = getCorsOrigin(requestOrigin);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key, idempotency-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

/**
 * @deprecated Use buildCorsHeaders(request.headers.get('origin')) instead
 * Kept for backwards compatibility during migration
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('PAYEEZ_ALLOWED_ORIGINS')?.split(',')[0] || '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key, idempotency-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Authenticate API request using API key
 * Uses the validate_api_key database function for secure bcrypt verification
 */
export async function authenticateApiKey(
  authHeader: string | null,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<AuthResult | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const apiKey = authHeader.slice(7);

  // Validate key format
  if (!apiKey.startsWith('sk_test_') && !apiKey.startsWith('sk_live_')) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Use the database function to validate API key (handles bcrypt comparison)
  const { data, error } = await supabase.rpc('validate_api_key', {
    p_full_key: apiKey,
  });

  if (error) {
    console.error('API key validation error:', error);
    return null;
  }

  const result = data?.[0];

  if (!result?.is_valid) {
    return null;
  }

  return {
    tenantId: result.tenant_id,
    environment: result.environment as 'test' | 'live',
  };
}

/**
 * Create error response
 */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Create success response
 */
export function successResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Authenticate client secret for session access
 */
export async function authenticateClientSecret(
  sessionId: string,
  clientSecret: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ tenantId: string; session: any } | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: session, error } = await supabase
    .from('payment_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('client_secret', clientSecret)
    .single();

  if (error || !session) {
    return null;
  }

  // Check if session is expired
  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    return null;
  }

  return {
    tenantId: session.tenant_id,
    session,
  };
}

/**
 * Generate a secure random string
 */
export function generateSecureToken(prefix: string, length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let token = prefix;
  for (let i = 0; i < length; i++) {
    token += chars[randomBytes[i] % chars.length];
  }

  return token;
}
