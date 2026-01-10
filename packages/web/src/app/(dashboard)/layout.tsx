import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  Shield,
  Webhook,
  LogOut,
  BookOpen,
  GitBranch,
  ChevronRight,
  Zap,
  Users,
  FileText,
  Plug,
  Cpu
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/dashboard/transactions', icon: CreditCard },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText },
  { name: 'Orchestration', href: '/dashboard/orchestration', icon: GitBranch },
  { name: 'Processors', href: '/dashboard/processors', icon: Cpu },
  { name: 'Vault', href: '/dashboard/vault', icon: Shield },
  { name: 'Integrations', href: '/dashboard/integrations', icon: Plug },
  { name: 'Webhooks', href: '/dashboard/webhooks', icon: Webhook },
  { name: 'Team', href: '/dashboard/team', icon: Users },
  { name: 'Docs', href: '/dashboard/docs', icon: BookOpen },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const initials = user.email?.slice(0, 2).toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-[var(--brand-ink)] text-white">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-[#0f1621] border-r border-white/10">
        <div className="flex h-16 items-center px-6 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/brand/atlas-mark.svg"
              alt="Atlas"
              width={36}
              height={36}
              className="h-9 w-9"
              priority
            />
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[#8ba3b7]">Atlas</div>
            </div>
          </Link>
        </div>

        {/* Environment Badge */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <Zap className="h-4 w-4 text-[#c8ff5a]" />
            <span className="text-sm font-medium text-[#c8ff5a]">Test Mode</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
            className="group flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[#9bb0c2] rounded-lg hover:bg-white/5 hover:text-white transition-all"
          >
              <item.icon className="h-5 w-5" />
              {item.name}
              <ChevronRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-9 w-9 bg-gradient-to-br from-[#19d1c3] to-[#c8ff5a]">
              <AvatarFallback className="bg-transparent text-[#081014] text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.email}</p>
              <p className="text-xs text-[#8ba3b7]">Sandbox plan</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-[#9bb0c2] hover:text-white">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#1a1a1a] border-white/10">
                <DropdownMenuItem asChild className="text-gray-300 focus:bg-white/10 focus:text-white">
                  <Link href="/dashboard/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <form action="/auth/signout" method="POST">
                  <DropdownMenuItem asChild className="text-gray-300 focus:bg-white/10 focus:text-white">
                    <button type="submit" className="w-full flex items-center">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
