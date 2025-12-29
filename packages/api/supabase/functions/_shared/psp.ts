import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptJson } from './crypto.ts';

export async function fetchPSPCredentials(
  supabase: SupabaseClient,
  tenantId: string,
  psp: string,
  environment: string,
  options: { logErrors?: boolean } = {}
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('psp_credentials')
    .select('credentials_encrypted')
    .eq('tenant_id', tenantId)
    .eq('psp', psp)
    .eq('environment', environment)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    if (options.logErrors && error) {
      console.error('Failed to load PSP credentials:', error);
    }
    return null;
  }

  try {
    return await decryptJson(data.credentials_encrypted || '{}');
  } catch (err) {
    if (options.logErrors) {
      console.error('Failed to decrypt PSP credentials:', err);
    }
    return null;
  }
}
