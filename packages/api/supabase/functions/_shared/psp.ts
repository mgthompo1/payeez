import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptJson } from './crypto.ts';

export async function fetchPSPCredentials(
  supabase: SupabaseClient,
  tenantId: string,
  psp: string,
  _environment?: string, // No longer used - we respect the PSP credential's own environment
  options: { logErrors?: boolean } = {}
): Promise<Record<string, unknown> | null> {
  // Get credentials for this PSP - use whatever environment is configured
  const { data, error } = await supabase
    .from('psp_credentials')
    .select('credentials_encrypted, environment')
    .eq('tenant_id', tenantId)
    .eq('psp', psp)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    if (options.logErrors && error) {
      console.error('Failed to load PSP credentials:', error);
    }
    return null;
  }

  try {
    const decryptedCreds = await decryptJson(data.credentials_encrypted || '{}');
    // Include the PSP credential's environment so adapters know which endpoint to use
    return {
      ...decryptedCreds,
      environment: data.environment,
    };
  } catch (err) {
    if (options.logErrors) {
      console.error('Failed to decrypt PSP credentials:', err);
    }
    return null;
  }
}
