import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MailPlus, Shield, Users } from 'lucide-react'
import { createInvite, updateMemberRole, removeMember, revokeInvite } from './actions'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('auth_id', user.id)
    .single()

  if (!profile) {
    return null
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', profile.id)
    .single()

  if (!membership) {
    return null
  }

  const { data: members } = await supabase
    .from('memberships')
    .select('role, created_at, users (id, email, name)')
    .eq('tenant_id', membership.tenant_id)
    .order('created_at', { ascending: true })

  const { data: invites } = await supabase
    .from('team_invites')
    .select('id, email, role, token, expires_at, accepted_at, revoked_at, created_at')
    .eq('tenant_id', membership.tenant_id)
    .order('created_at', { ascending: false })

  const isAdmin = ['owner', 'admin'].includes(membership.role)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-gray-500 mt-1">Invite teammates and manage access levels.</p>
        </div>
        <Badge className="bg-white/5 text-gray-300 border-white/10 flex items-center gap-2">
          <Shield className="h-3 w-3" />
          {membership.role}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl bg-[#111] border border-white/10 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Users className="h-5 w-5 text-[#19d1c3]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Members</h2>
              <p className="text-sm text-gray-500">Active members in your workspace.</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Member</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(members || []).map((member) => {
                  const memberUser = Array.isArray(member.users) ? member.users[0] : member.users
                  const isSelf = memberUser?.id === profile.id
                  return (
                    <tr key={memberUser?.id} className="border-t border-white/10">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{memberUser?.name || 'Member'}</div>
                        <div className="text-xs text-gray-500">{memberUser?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <form action={updateMemberRole} className="flex items-center gap-2">
                            <input type="hidden" name="user_id" value={memberUser?.id || ''} />
                            <select
                              name="role"
                              defaultValue={member.role}
                              className="h-8 rounded-md border border-white/10 bg-[#0a0a0a] px-2 text-xs text-white"
                              disabled={isSelf}
                            >
                              <option value="owner">owner</option>
                              <option value="admin">admin</option>
                              <option value="member">member</option>
                            </select>
                            <Button type="submit" size="sm" variant="outline" className="border-white/10 text-xs text-gray-300">
                              Save
                            </Button>
                          </form>
                        ) : (
                          <Badge className="bg-white/5 text-gray-300 border-white/10">{member.role}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {member.created_at ? new Date(member.created_at).toLocaleDateString() : '-'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          {!isSelf && (
                            <form action={removeMember}>
                              <input type="hidden" name="user_id" value={memberUser?.id || ''} />
                              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300">
                                Remove
                              </Button>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-[#111] border border-white/10 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
              <MailPlus className="h-5 w-5 text-[#c8ff5a]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Invite members</h2>
              <p className="text-sm text-gray-500">Share an invite link or send by email.</p>
            </div>
          </div>

          <form action={createInvite} className="space-y-3">
            <Input
              name="email"
              type="email"
              placeholder="teammate@company.com"
              className="bg-[#0a0a0a] border-white/10 text-white"
              required
              disabled={!isAdmin}
            />
            <div className="flex items-center gap-2">
              <select
                name="role"
                defaultValue="member"
                className="h-9 flex-1 rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white"
                disabled={!isAdmin}
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
              <Button
                type="submit"
                disabled={!isAdmin}
                className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
              >
                Invite
              </Button>
            </div>
          </form>

          <div className="pt-2">
            <h3 className="text-sm font-semibold text-white mb-2">Pending invites</h3>
            <div className="space-y-3">
              {(invites || []).length === 0 && (
                <div className="text-sm text-gray-500">No invites sent yet.</div>
              )}
              {(invites || []).map((invite) => {
                const status = invite.revoked_at
                  ? 'revoked'
                  : invite.accepted_at
                    ? 'accepted'
                    : invite.expires_at && new Date(invite.expires_at) < new Date()
                      ? 'expired'
                      : 'pending'
                const inviteUrl = `${baseUrl}/invite/${invite.token}`
                return (
                  <div key={invite.id} className="rounded-xl border border-white/10 bg-[#0a0a0a] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white">{invite.email}</div>
                        <div className="text-xs text-gray-500">{invite.role} · {status}</div>
                      </div>
                      {isAdmin && status === 'pending' && (
                        <form action={revokeInvite}>
                          <input type="hidden" name="invite_id" value={invite.id} />
                          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300">
                            Revoke
                          </Button>
                        </form>
                      )}
                    </div>
                    <code className="block text-xs text-[#19d1c3] break-all">{inviteUrl}</code>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
