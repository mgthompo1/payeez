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
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Team</h1>
          <p className="text-slate-500 mt-1">Invite teammates and manage workspace access levels.</p>
        </div>
        <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 flex items-center gap-2 h-8 px-3 rounded-full">
          <Shield className="h-3.5 w-3.5" />
          <span className="capitalize">{membership.role}</span>
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.6fr]">
        <div className="dashboard-card overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <Users className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Workspace Members</h2>
              <p className="text-sm text-slate-500">Active users with access to this tenant.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">User</th>
                  <th className="px-6 py-4 text-left font-semibold">Role</th>
                  <th className="px-6 py-4 text-left font-semibold">Joined</th>
                  {isAdmin && <th className="px-6 py-4 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(members || []).map((member) => {
                  const memberUser = Array.isArray(member.users) ? member.users[0] : member.users
                  const isSelf = memberUser?.id === profile.id
                  return (
                    <tr key={memberUser?.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">{memberUser?.name || 'Member'}</div>
                        <div className="text-xs text-slate-500">{memberUser?.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        {isAdmin ? (
                          <form action={updateMemberRole} className="flex items-center gap-2">
                            <input type="hidden" name="user_id" value={memberUser?.id || ''} />
                            <select
                              name="role"
                              defaultValue={member.role}
                              className="h-8 rounded-lg border border-white/10 bg-obsidian px-2 text-xs text-white focus:border-cyan-400 transition-all outline-none"
                              disabled={isSelf}
                            >
                              <option value="owner">owner</option>
                              <option value="admin">admin</option>
                              <option value="member">member</option>
                            </select>
                            <Button type="submit" size="sm" variant="ghost" className="text-cyan-400 hover:bg-cyan-400/10 h-8 px-3 rounded-md text-xs">
                              Save
                            </Button>
                          </form>
                        ) : (
                          <Badge className="bg-white/5 text-slate-400 border-white/10">{member.role}</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {member.created_at ? new Date(member.created_at).toLocaleDateString() : '-'}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          {!isSelf && (
                            <form action={removeMember}>
                              <input type="hidden" name="user_id" value={memberUser?.id || ''} />
                              <Button size="sm" variant="ghost" className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-full h-8 px-3">
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

        <div className="space-y-6">
          <div className="dashboard-card p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <MailPlus className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Invite Teammate</h2>
                <p className="text-sm text-slate-500">Add a new user to your workspace.</p>
              </div>
            </div>

            <form action={createInvite} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Email Address</Label>
                <Input
                  name="email"
                  type="email"
                  placeholder="teammate@company.com"
                  className="bg-obsidian border-white/10 text-white focus:border-cyan-400 transition-all placeholder:text-slate-600"
                  required
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Workspace Role</Label>
                <div className="flex items-center gap-2">
                  <select
                    name="role"
                    defaultValue="member"
                    className="h-10 flex-1 rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 transition-all outline-none"
                    disabled={!isAdmin}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                  <Button
                    type="submit"
                    disabled={!isAdmin}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold h-10 px-6 rounded-full shadow-lg shadow-cyan-500/20"
                  >
                    Send Invite
                  </Button>
                </div>
              </div>
            </form>
          </div>

          <div className="dashboard-card p-6">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-cyan-400" />
              Pending Invitations
            </h3>
            <div className="space-y-3">
              {(invites || []).length === 0 && (
                <div className="text-sm text-slate-500 italic py-4">No active invitations.</div>
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
                  <div key={invite.id} className="rounded-xl border border-white/5 bg-obsidian/50 p-4 space-y-3 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-200">{invite.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] uppercase border-white/10 text-slate-500 py-0">{invite.role}</Badge>
                          <span className={`text-[10px] uppercase font-bold ${status === 'pending' ? 'text-amber-400' : 'text-slate-600'}`}>{status}</span>
                        </div>
                      </div>
                      {isAdmin && status === 'pending' && (
                        <form action={revokeInvite}>
                          <input type="hidden" name="invite_id" value={invite.id} />
                          <Button size="sm" variant="ghost" className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 h-8 w-8 rounded-full">
                            <X className="h-4 w-4" />
                          </Button>
                        </form>
                      )}
                    </div>
                    <div className="relative group">
                      <code className="block text-[10px] text-slate-500 bg-black/30 p-2 rounded border border-white/5 break-all font-mono group-hover:text-cyan-400 transition-colors">{inviteUrl}</code>
                    </div>
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