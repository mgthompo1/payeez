'use server'

import { createClient } from '@/lib/supabase/server'
import { encryptJson } from '@/lib/crypto'

export async function createPspCredential(params: {
  psp: string
  environment: 'test' | 'live'
  credentials: Record<string, string>
}) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('You must be signed in to add credentials.')
  }

  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single()

  if (membershipError || !membership) {
    throw new Error('Unable to resolve tenant membership.')
  }

  const encryptedCredentials = encryptJson({
    ...params.credentials,
    environment: params.environment,
  })

  const { error } = await supabase
    .from('psp_credentials')
    .insert({
      tenant_id: membership.tenant_id,
      psp: params.psp,
      environment: params.environment,
      credentials_encrypted: encryptedCredentials,
      is_active: true,
    })

  if (error) {
    throw new Error(error.message)
  }
}
