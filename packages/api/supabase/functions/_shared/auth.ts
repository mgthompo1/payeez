import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AuthResult {
  tenantId: string;
  environment: 'test' | 'live';
}

/**
 * Authenticate API request using API key
 * Returns tenant ID and environment if valid
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
  const keyPrefix = apiKey.slice(0, 8); // "sk_test_" or "sk_live_"

  // Determine environment from prefix
  let environment: 'test' | 'live';
  if (keyPrefix === 'sk_test_') {
    environment = 'test';
  } else if (keyPrefix === 'sk_live_') {
    environment = 'live';
  } else {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Look up API key by prefix, then verify hash
  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, tenant_id, key_hash')
    .eq('key_prefix', keyPrefix)
    .eq('environment', environment)
    .is('revoked_at', null);

  if (error || !keys?.length) {
    return null;
  }

  // For now, simple comparison (in production, use bcrypt)
  // TODO: Implement proper bcrypt verification
  for (const key of keys) {
    // Placeholder: compare full key hash
    // In production: await bcrypt.compare(apiKey, key.key_hash)
    if (key.key_hash === apiKey) {
      // Update last_used_at
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', key.id);

      return {
        tenantId: key.tenant_id,
        environment,
      };
    }
  }

  return null;
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
