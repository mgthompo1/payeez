'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ApiKey {
  id: string
  key_prefix: string
  label: string
  environment: string
  last_used_at: string | null
  created_at: string
  is_revoked: boolean
}

export interface CreateKeyResult {
  id: string
  key_prefix: string
  full_key: string
  label: string
  environment: string
  created_at: string
}

export async function getApiKeys(): Promise<ApiKey[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_api_keys')

  if (error) {
    console.error('Error fetching API keys:', error)
    return []
  }

  return data || []
}

export async function createApiKey(
  label: string,
  environment: 'test' | 'live' = 'test'
): Promise<CreateKeyResult | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('generate_api_key', {
    p_label: label,
    p_environment: environment,
  })

  if (error) {
    console.error('Error creating API key:', error)
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/api-keys')

  return data?.[0] || null
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('revoke_api_key', {
    p_key_id: keyId,
  })

  if (error) {
    console.error('Error revoking API key:', error)
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/api-keys')

  return data === true
}

export async function getCurrentTenant() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get user's tenant info
  const { data: membership, error } = await supabase
    .from('memberships')
    .select(`
      tenant_id,
      role,
      tenants (
        id,
        name,
        slug,
        environment
      )
    `)
    .eq('user_id', user.id)
    .single()

  if (error) {
    // User might not have tenant yet (new signup before trigger runs)
    return null
  }

  return membership
}
