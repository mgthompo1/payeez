import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { acceptInvite } from './actions'

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-[#111] p-8 text-center space-y-4">
          <h1 className="text-2xl font-semibold">Join your team</h1>
          <p className="text-sm text-gray-400">
            Sign in or create an account to accept your invite.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
              <Link href={`/login?invite=${params.token}`}>Sign in</Link>
            </Button>
            <Button variant="outline" asChild className="border-white/10 text-gray-300 hover:bg-white/5">
              <Link href={`/signup?invite=${params.token}`}>Create account</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6">
      <div className="max-w-md rounded-2xl border border-white/10 bg-[#111] p-8 text-center space-y-4">
        <h1 className="text-2xl font-semibold">Accept team invite</h1>
        <p className="text-sm text-gray-400">
          You are signed in as {user.email}. Continue to join this workspace.
        </p>
        <form action={acceptInvite}>
          <input type="hidden" name="token" value={params.token} />
          <Button type="submit" className="w-full bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
            Accept invite
          </Button>
        </form>
        <Button variant="ghost" asChild className="text-gray-400 hover:text-white">
          <Link href="/dashboard">Go back</Link>
        </Button>
      </div>
    </div>
  )
}
