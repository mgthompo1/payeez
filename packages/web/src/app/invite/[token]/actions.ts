'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get('token') || '')
  if (!token) {
    throw new Error('Invalid invite token.')
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('You must be signed in to accept this invite.')
  }

  const { error } = await supabase.rpc('accept_team_invite', { p_token: token })

  if (error) {
    throw new Error(error.message)
  }

  redirect('/dashboard/team')
}
