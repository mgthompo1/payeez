import { redirect } from 'next/navigation'
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
  Users,
  Cpu,
  UserCircle,
  Repeat,
  Receipt,
  Search,
  Landmark,
  FlaskConical
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavSection {
  title?: string
  items: Array<{
    name: string
    href: string
    icon: any
  }>
}

const navigationSections: NavSection[] = [
  {
    items: [
      { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Transactions', href: '/dashboard/transactions', icon: CreditCard },
    ]
  },
  {
    title: 'Billing',
    items: [
      { name: 'Customers', href: '/dashboard/customers', icon: UserCircle },
      { name: 'Subscriptions', href: '/dashboard/subscriptions', icon: Repeat },
      { name: 'Invoices', href: '/dashboard/invoices', icon: Receipt },
      { name: 'Bank Accounts', href: '/dashboard/bank-accounts', icon: Landmark },
    ]
  },
  {
    title: 'Platform',
    items: [
      { name: 'Orchestration', href: '/dashboard/orchestration', icon: GitBranch },
      { name: 'Processors', href: '/dashboard/processors', icon: Cpu },
      { name: 'Vault', href: '/dashboard/vault', icon: Shield },
    ]
  },
  {
    title: 'Developers',
    items: [
      { name: 'Playground', href: '/dashboard/playground', icon: FlaskConical },
      { name: 'Webhooks', href: '/dashboard/webhooks', icon: Webhook },
      { name: 'Docs', href: '/dashboard/docs', icon: BookOpen },
    ]
  },
  {
    items: [
      { name: 'Team', href: '/dashboard/team', icon: Users },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ]
  },
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
    <div className="flex h-screen overflow-hidden bg-obsidian text-[#E5E5E5] font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* High-Density Sidebar */}
      <aside className="w-64 bg-charcoal border-r border-white/5 flex flex-col justify-between z-20">
        <div>
          {/* Header */}
          <div className="h-14 flex items-center px-4 border-b border-white/5">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-6 h-6 flex items-center justify-center rounded-sm transition-transform group-hover:scale-105">
                <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5z"/>
                </svg>
              </div>
              <span className="font-medium tracking-tight text-sm text-white">Atlas Console</span>
            </Link>
          </div>

          {/* Context Switcher */}
          <div className="px-4 py-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-slate-300 hover:bg-white/10 hover:border-cyan-500/20 transition cursor-pointer group">
                  <span className="truncate group-hover:text-cyan-400 transition-colors">Production</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                    <ChevronRight className="w-3 h-3 text-slate-500 rotate-90" />
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-charcoal border-white/10 text-white">
                <DropdownMenuItem className="text-xs hover:bg-white/5 focus:bg-white/5 cursor-pointer flex justify-between">
                  <span>Production</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs hover:bg-white/5 focus:bg-white/5 cursor-pointer flex justify-between">
                  <span>Sandbox</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Navigation */}
          <nav className="px-2 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {navigationSections.map((section, idx) => (
              <div key={idx} className="space-y-0.5">
                {section.title && (
                  <div className="px-3 mb-2 text-[10px] font-mono text-cyan-400/60 uppercase tracking-wider">
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/20 rounded-md transition-all duration-200 group"
                  >
                    <item.icon className="w-4 h-4 opacity-70 group-hover:text-cyan-400 group-hover:opacity-100" />
                    {item.name}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full group">
                <div className="w-8 h-8 rounded-full bg-cyan-900/20 border border-cyan-500/20 flex items-center justify-center text-[10px] font-mono font-medium text-cyan-400 group-hover:bg-cyan-900/30 transition-colors">
                  {initials}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium text-white truncate group-hover:text-cyan-400 transition-colors">{user.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-slate-500 truncate">Engineering</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-48 bg-charcoal border-white/10 text-white ml-2">
              <DropdownMenuItem asChild className="text-xs focus:bg-white/10 cursor-pointer">
                <Link href="/dashboard/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <form action="/auth/signout" method="POST">
                <DropdownMenuItem asChild className="text-xs focus:bg-white/10 cursor-pointer text-red-400 focus:text-red-400">
                  <button type="submit" className="w-full flex items-center">
                    Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-obsidian relative">
        
        {/* Top Metric Bar (Ticker Style) */}
        <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-charcoal/80 backdrop-blur z-10 shrink-0">
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center bg-white/5 rounded px-2 py-1 border border-white/10 hover:border-cyan-500/30 transition-colors cursor-pointer">
              <Search className="w-3 h-3 text-slate-400 mr-2" />
              <span className="text-[10px] text-slate-400 font-mono">CMD + K</span>
            </div>
            <div className="h-4 w-px bg-white/10"></div>
            <div className="text-[10px] font-mono text-slate-500">us-east-1</div>
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)] status-dot"></div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto relative">
           {children}
        </div>
      </main>
    </div>
  )
}
