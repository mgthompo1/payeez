'use server'

import { createClient } from '@/lib/supabase/server'
import { encryptJson } from '@/lib/crypto'

export async function createPspCredential(params: {
  id?: string  // If provided, update instead of create
  psp: string
  environment: 'test' | 'live'
  credentials: Record<string, string>
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'You must be signed in to add credentials.' }
    }

    console.log('Auth user ID:', user.id)

    // First get the internal user record by auth_id
    const { data: internalUser, error: userLookupError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    console.log('Internal user lookup:', { internalUser, userLookupError })

    let userId = internalUser?.id

    if (userLookupError || !internalUser) {
      console.log('User not found, attempting onboard...')
      // Try to onboard the user if they don't exist
      const { error: onboardError } = await supabase.rpc('onboard_existing_user')
      console.log('Onboard result:', { onboardError })

      if (onboardError) {
        return { success: false, error: `Unable to find or create user account: ${onboardError.message}` }
      }

      // Retry after onboarding
      const { data: retryUser, error: retryError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      console.log('Retry user lookup:', { retryUser, retryError })

      if (!retryUser) {
        return { success: false, error: 'Unable to resolve user account after onboarding.' }
      }
      userId = retryUser.id
    }

    console.log('Using userId:', userId)

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('tenant_id, role')
      .eq('user_id', userId)
      .single()

    console.log('Membership lookup:', { membership, membershipError })

    if (membershipError || !membership) {
      return { success: false, error: `Unable to resolve tenant membership: ${membershipError?.message || 'no membership found'}` }
    }

    // Don't overwrite PSP-specific environment with dropdown environment
    const encryptedCredentials = encryptJson(params.credentials)

    if (params.id) {
      // Update existing credential
      const { error } = await supabase
        .from('psp_credentials')
        .update({
          environment: params.environment,
          credentials_encrypted: encryptedCredentials,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('tenant_id', membership.tenant_id)

      if (error) {
        return { success: false, error: error.message }
      }
    } else {
      // Insert new credential
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
        return { success: false, error: error.message }
      }
    }

    return { success: true }
  } catch (err) {
    console.error('createPspCredential error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred'
    }
  }
}
