import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowUpRight, CreditCard, DollarSign, TrendingUp, AlertCircle, ArrowRight, Terminal, Key, GitBranch, Webhook } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const stats = [
    {
      title: 'Total Volume',
      value: '$0.00',
      change: '+0%',
      changeType: 'neutral',
      description: 'This month',
      icon: DollarSign,
      gradient: 'from-[#19d1c3] to-[#4cc3ff]',
    },
    {
      title: 'Transactions',
      value: '0',
      change: '+0',
      changeType: 'neutral',
      description: 'This month',
      icon: CreditCard,
      gradient: 'from-[#c8ff5a] to-[#19d1c3]',
    },
    {
      title: 'Success Rate',
      value: '—',
      change: '—',
      changeType: 'neutral',
      description: 'Last 30 days',
      icon: TrendingUp,
      gradient: 'from-[#4cc3ff] to-[#c8ff5a]',
    },
    {
      title: 'Failed',
      value: '0',
      change: '0',
      changeType: 'neutral',
      description: 'Needs attention',
      icon: AlertCircle,
      gradient: 'from-[#ff7a7a] to-[#ffb454]',
    },
  ]

  const setupSteps = [
    {
      step: 1,
      title: 'Configure a processor',
      description: 'Add credentials for Stripe, Adyen, or another payment processor',
      href: '/dashboard/settings',
      completed: false,
      icon: GitBranch,
    },
    {
      step: 2,
      title: 'Create an API key',
      description: 'Generate a secret key to authenticate your API requests',
      href: '/dashboard/api-keys',
      completed: false,
      icon: Key,
    },
    {
      step: 3,
      title: 'Set up webhooks',
      description: 'Configure endpoints to receive payment events',
      href: '/dashboard/webhooks',
      completed: false,
      icon: Webhook,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Control Room</h1>
        <p className="text-[#9bb0c2] mt-1">Live view of routing health and payment volume</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="relative overflow-hidden rounded-2xl bg-[#0f1621] border border-white/10 p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#8ba3b7]">{stat.title}</p>
                <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-[#8ba3b7]">{stat.description}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            {/* Decorative gradient */}
            <div className={`absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10 blur-2xl`} />
          </div>
        ))}
      </div>

      {/* Quick Start & Integration */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Getting Started */}
        <div className="rounded-2xl bg-[#0f1621] border border-white/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Getting Started</h2>
              <p className="text-sm text-[#8ba3b7]">Complete these steps to route production traffic</p>
            </div>
            <span className="text-sm text-[#8ba3b7]">0/3 complete</span>
          </div>
          <div className="space-y-3">
            {setupSteps.map((item) => (
              <Link
                key={item.step}
                href={item.href}
                className="group flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  item.completed
                    ? 'bg-[#19d1c3]/20 text-[#19d1c3]'
                    : 'bg-[#0b111a] text-[#c8ff5a]'
                }`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-sm text-[#8ba3b7]">{item.description}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-[#8ba3b7] group-hover:text-white transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Integration */}
        <div className="rounded-2xl bg-[#0f1621] border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Terminal className="h-5 w-5 text-[#19d1c3]" />
            <h2 className="text-lg font-semibold text-white">Quick Integration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#8ba3b7] mb-2">1. Install the SDK</p>
              <div className="bg-[#0b111a] rounded-lg p-4 font-mono text-sm">
                <span className="text-[#66788c]">$</span>{' '}
                <span className="text-[#c8ff5a]">npm install</span>{' '}
                <span className="text-white">@payeez/sdk</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-[#8ba3b7] mb-2">2. Create a payment session</p>
              <div className="bg-[#0b111a] rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-[#c4d2e1]">
{`const session = await fetch('/api/pay', {
  method: 'POST',
  body: JSON.stringify({ amount: 4990 })
});`}
                </pre>
              </div>
            </div>

            <div>
              <p className="text-sm text-[#8ba3b7] mb-2">3. Mount the payment form</p>
              <div className="bg-[#0b111a] rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-[#c4d2e1]">
{`Payeez.mount({
  sessionId: session.id,
  clientSecret: session.client_secret,
  onSuccess: (payment) => redirect('/success')
});`}
                </pre>
              </div>
            </div>

            <Link
              href="/dashboard/docs"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] text-[#081014] font-medium hover:opacity-90 transition-opacity"
            >
              View full documentation
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl bg-[#0f1621] border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
          <Link
            href="/dashboard/transactions"
            className="text-sm text-[#19d1c3] hover:text-[#3be3d2] transition-colors flex items-center gap-1"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
            <CreditCard className="h-6 w-6 text-gray-500" />
          </div>
          <p className="text-gray-400 mb-2">No transactions yet</p>
          <p className="text-sm text-gray-500 max-w-sm">
            Once you start processing payments, your recent transactions will appear here.
          </p>
        </div>
      </div>
    </div>
  )
}
