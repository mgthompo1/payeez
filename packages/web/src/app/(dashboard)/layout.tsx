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
  Cpu,
  UserCircle,
  Repeat,
  Receipt,
  Key
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

interface NavSection {
  title?: string
  items: Array<{
    name: string
    href: string
    icon: any
    feature?: 'billing' // Feature flag key
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
      { name: 'Customers', href: '/dashboard/customers', icon: UserCircle, feature: 'billing' },
      { name: 'Subscriptions', href: '/dashboard/subscriptions', icon: Repeat, feature: 'billing' },
      { name: 'Invoices', href: '/dashboard/invoices', icon: Receipt, feature: 'billing' },
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
      { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
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

  // Get tenant features (billing enabled by default for now)
  // In production, fetch from tenant settings
  const enabledFeatures = {
    billing: true, // Toggle to show/hide billing section
  }

  const initials = user.email?.slice(0, 2).toUpperCase() || 'U'

  // Filter sections based on enabled features
  const visibleSections = navigationSections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        !item.feature || enabledFeatures[item.feature as keyof typeof enabledFeatures]
      )
    }))
    .filter(section => section.items.length > 0)

  return (
    <div className="min-h-screen bg-[var(--brand-ink)] text-white">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-56 bg-[#0f1621] border-r border-white/10">
        <div className="flex h-14 items-center px-4 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/brand/atlas-mark.svg"
              alt="Atlas"
              width={28}
              height={28}
              className="h-7 w-7"
              priority
            />
            <span className="text-sm font-semibold text-white">Atlas</span>
          </Link>
        </div>

        {/* Environment Badge */}
        <div className="px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#c8ff5a]/10 border border-[#c8ff5a]/20">
            <Zap className="h-3.5 w-3.5 text-[#c8ff5a]" />
            <span className="text-xs font-medium text-[#c8ff5a]">Test Mode</span>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {visibleSections.map((section, sectionIndex) => (
            <div key={section.title || sectionIndex} className={section.title ? 'mt-4 first:mt-0' : ''}>
              {section.title && (
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-[#6b7c8a] font-medium">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="group flex items-center gap-2.5 px-2 py-1.5 text-sm text-[#9bb0c2] rounded-md hover:bg-white/5 hover:text-white transition-all"
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors">
                <Avatar className="h-7 w-7 bg-gradient-to-br from-[#19d1c3] to-[#c8ff5a]">
                  <AvatarFallback className="bg-transparent text-[#081014] text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium text-white truncate">{user.email}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-[#6b7c8a]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-48 bg-[#1a1a1a] border-white/10">
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

      {/* Main content */}
      <div className="pl-56">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
