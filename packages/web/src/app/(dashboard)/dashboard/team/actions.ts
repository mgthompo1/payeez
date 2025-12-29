'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function getMembershipContext() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('You must be signed in.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('auth_id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('Unable to resolve user profile.')
  }

  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', profile.id)
    .single()

  if (membershipError || !membership) {
    throw new Error('Unable to resolve tenant membership.')
  }

  return { supabase, profile, membership }
}

export async function createInvite(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const role = String(formData.get('role') || 'member') as 'owner' | 'admin' | 'member'

  if (!email) {
    throw new Error('Invite email is required.')
  }

  const { supabase, profile, membership } = await getMembershipContext()

  if (!['owner', 'admin'].includes(membership.role)) {
    throw new Error('Only admins can invite members.')
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('team_invites')
    .insert({
      tenant_id: membership.tenant_id,
      email,
      role,
      token,
      invited_by: profile.id,
      expires_at: expiresAt,
    })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/team')
}

export async function updateMemberRole(formData: FormData) {
  const userId = String(formData.get('user_id') || '')
  const role = String(formData.get('role') || '') as 'owner' | 'admin' | 'member'

  if (!userId || !role) {
    throw new Error('Missing member information.')
  }

  const { supabase, profile, membership } = await getMembershipContext()

  if (!['owner', 'admin'].includes(membership.role)) {
    throw new Error('Only admins can update roles.')
  }

  if (membership.role !== 'owner' && role === 'owner') {
    throw new Error('Only owners can promote another owner.')
  }

  if (profile.id === userId && membership.role !== role) {
    throw new Error('You cannot change your own role.')
  }

  const { error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('user_id', userId)
    .eq('tenant_id', membership.tenant_id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/team')
}

export async function removeMember(formData: FormData) {
  const userId = String(formData.get('user_id') || '')

  if (!userId) {
    throw new Error('Missing member information.')
  }

  const { supabase, profile, membership } = await getMembershipContext()

  if (!['owner', 'admin'].includes(membership.role)) {
    throw new Error('Only admins can remove members.')
  }

  if (profile.id === userId) {
    throw new Error('You cannot remove yourself.')
  }

  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('user_id', userId)
    .eq('tenant_id', membership.tenant_id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/team')
}

export async function revokeInvite(formData: FormData) {
  const inviteId = String(formData.get('invite_id') || '')

  if (!inviteId) {
    throw new Error('Missing invite information.')
  }

  const { supabase, membership } = await getMembershipContext()

  if (!['owner', 'admin'].includes(membership.role)) {
    throw new Error('Only admins can revoke invites.')
  }

  const { error } = await supabase
    .from('team_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('tenant_id', membership.tenant_id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/team')
}
