import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get user's tenant
  const { data: { user } } = await supabase.auth.getUser()

  // For now, show placeholder stats
  // In production, these would come from real queries
  const stats = [
    {
      title: 'Total Volume',
      value: '$0.00',
      description: 'This month',
      icon: DollarSign,
    },
    {
      title: 'Transactions',
      value: '0',
      description: 'This month',
      icon: CreditCard,
    },
    {
      title: 'Success Rate',
      value: '0%',
      description: 'Last 30 days',
      icon: TrendingUp,
    },
    {
      title: 'Failed',
      value: '0',
      description: 'Requires attention',
      icon: AlertCircle,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Overview of your payment activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-500">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Complete these steps to start accepting payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                1
              </div>
              <div>
                <p className="font-medium">Configure a PSP</p>
                <p className="text-sm text-gray-500">Add credentials for Stripe, Adyen, or another payment processor</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold">
                2
              </div>
              <div>
                <p className="font-medium">Create an API Key</p>
                <p className="text-sm text-gray-500">Generate a secret key to authenticate API requests</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold">
                3
              </div>
              <div>
                <p className="font-medium">Integrate the SDK</p>
                <p className="text-sm text-gray-500">Add Payeez.js to your checkout page</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
