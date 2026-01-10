'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Repeat,
  Search,
  MoreHorizontal,
  Pause,
  Play,
  XCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  User,
  Copy,
  Check
} from 'lucide-react'

interface SubscriptionItem {
  id: string
  price_id: string
  quantity: number
  prices: {
    id: string
    product_id: string
    unit_amount: number
    currency: string
    recurring_interval: string
    recurring_interval_count: number
    products: {
      name: string
    }
  }
}

interface Subscription {
  id: string
  customer_id: string
  status: string
  current_period_start: string
  current_period_end: string
  trial_start: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  created_at: string
  customers: {
    email: string
    name: string | null
  }
  subscription_items: SubscriptionItem[]
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Active', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
  trialing: { label: 'Trialing', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Clock },
  past_due: { label: 'Past Due', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertCircle },
  canceled: { label: 'Canceled', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: XCircle },
  unpaid: { label: 'Unpaid', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertCircle },
  paused: { label: 'Paused', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Pause },
  incomplete: { label: 'Incomplete', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Clock },
  incomplete_expired: { label: 'Expired', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: XCircle },
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    loadSubscriptions()
  }, [])

  const loadSubscriptions = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        customers (
          email,
          name
        ),
        subscription_items (
          id,
          price_id,
          quantity,
          prices (
            id,
            product_id,
            unit_amount,
            currency,
            recurring_interval,
            recurring_interval_count,
            products (
              name
            )
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSubscriptions(data as Subscription[])
    }

    setLoading(false)
  }

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch =
      sub.customers?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const formatInterval = (interval: string, count: number) => {
    if (count === 1) return `/${interval}`
    return `every ${count} ${interval}s`
  }

  const getMonthlyValue = (sub: Subscription) => {
    let total = 0
    sub.subscription_items?.forEach(item => {
      const price = item.prices
      if (price?.unit_amount) {
        let amount = price.unit_amount * item.quantity
        // Convert to monthly
        switch (price.recurring_interval) {
          case 'day':
            amount = amount * 30
            break
          case 'week':
            amount = amount * 4
            break
          case 'year':
            amount = amount / 12
            break
        }
        total += amount
      }
    })
    return total
  }

  const cancelSubscription = async (subId: string) => {
    const supabase = createClient()
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        ended_at: new Date().toISOString()
      })
      .eq('id', subId)
    loadSubscriptions()
    setSelectedSubscription(null)
  }

  const pauseSubscription = async (subId: string) => {
    const supabase = createClient()
    await supabase
      .from('subscriptions')
      .update({ status: 'paused', paused_at: new Date().toISOString() })
      .eq('id', subId)
    loadSubscriptions()
  }

  const resumeSubscription = async (subId: string) => {
    const supabase = createClient()
    await supabase
      .from('subscriptions')
      .update({ status: 'active', paused_at: null, resumed_at: new Date().toISOString() })
      .eq('id', subId)
    loadSubscriptions()
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status] || statusConfig.incomplete
    const Icon = config.icon
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Subscriptions</h1>
          <p className="text-slate-500 mt-1">Manage recurring billing subscriptions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card p-6">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search by customer email, name, or subscription ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-obsidian border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-white/10 bg-obsidian px-3 text-sm text-white min-w-[150px] focus:border-cyan-400"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="paused">Paused</option>
            <option value="canceled">Canceled</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">All Subscriptions</h2>
          <p className="text-sm text-slate-500">{filteredSubscriptions.length} subscriptions</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent"></div>
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                <Repeat className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-2">No subscriptions found</p>
              <p className="text-sm text-slate-500">Create subscriptions via the API</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Plan</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">MRR</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Current Period</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((subscription) => (
                  <tr
                    key={subscription.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={() => setSelectedSubscription(subscription)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                          <span className="text-cyan-400 font-medium">
                            {(subscription.customers?.name || subscription.customers?.email || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-white font-medium group-hover:text-cyan-400 transition-colors">
                            {subscription.customers?.name || 'Unnamed'}
                          </span>
                          <p className="text-xs text-slate-500">{subscription.customers?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={subscription.status} />
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        {subscription.subscription_items?.map((item) => (
                          <div key={item.id} className="text-sm">
                            <span className="text-slate-300">{item.prices?.products?.name}</span>
                            {item.quantity > 1 && (
                              <span className="text-slate-500 ml-1">x{item.quantity}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-white font-medium">
                        {formatAmount(getMonthlyValue(subscription), 'usd')}
                      </span>
                      <span className="text-slate-500 text-sm">/mo</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-400 text-sm">
                        {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-charcoal border-white/10">
                          {subscription.status === 'active' && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                pauseSubscription(subscription.id)
                              }}
                              className="text-slate-300 focus:bg-white/10 focus:text-white"
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          )}
                          {subscription.status === 'paused' && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                resumeSubscription(subscription.id)
                              }}
                              className="text-slate-300 focus:bg-white/10 focus:text-white"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          {!['canceled', 'incomplete_expired'].includes(subscription.status) && (
                            <>
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  cancelSubscription(subscription.id)
                                }}
                                className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Detail Sheet */}
      <Sheet open={!!selectedSubscription} onOpenChange={() => setSelectedSubscription(null)}>
        <SheetContent className="bg-charcoal border-white/10 w-[500px] sm:max-w-[500px] overflow-y-auto text-slate-300">
          <SheetHeader>
            <SheetTitle className="text-white">Subscription Details</SheetTitle>
          </SheetHeader>

          {selectedSubscription && (
            <div className="mt-6 space-y-6">
              {/* Status Card */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center justify-between mb-4">
                  <StatusBadge status={selectedSubscription.status} />
                  <span className="text-2xl font-bold text-white">
                    {formatAmount(getMonthlyValue(selectedSubscription), 'usd')}
                    <span className="text-sm font-normal text-slate-500">/mo</span>
                  </span>
                </div>
                {selectedSubscription.cancel_at_period_end && (
                  <div className="text-sm text-amber-400">
                    Cancels at end of billing period
                  </div>
                )}
              </div>

              {/* Customer */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</h3>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <User className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="text-white">{selectedSubscription.customers?.name || 'Unnamed'}</div>
                    <div className="text-sm text-slate-500">{selectedSubscription.customers?.email}</div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Items</h3>
                <div className="space-y-2">
                  {selectedSubscription.subscription_items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-4 w-4 text-slate-500" />
                        <div>
                          <div className="text-white">{item.prices?.products?.name}</div>
                          <div className="text-sm text-slate-500">
                            {item.prices?.unit_amount && formatAmount(item.prices.unit_amount, item.prices.currency)}
                            {formatInterval(item.prices?.recurring_interval, item.prices?.recurring_interval_count)}
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing Period */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Billing Period</h3>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <div className="text-white">
                    {formatDate(selectedSubscription.current_period_start)} - {formatDate(selectedSubscription.current_period_end)}
                  </div>
                </div>
              </div>

              {/* Trial Info */}
              {selectedSubscription.trial_end && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Trial</h3>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <Clock className="h-4 w-4 text-cyan-400" />
                    <div className="text-cyan-400">
                      Trial ends {formatDate(selectedSubscription.trial_end)}
                    </div>
                  </div>
                </div>
              )}

              {/* IDs */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Identifiers</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div>
                      <div className="text-xs text-slate-500">Subscription ID</div>
                      <code className="text-sm text-cyan-400">{selectedSubscription.id}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(selectedSubscription.id, 'sub_id')}
                      className="h-8 w-8 text-slate-400 hover:text-white"
                    >
                      {copied === 'sub_id' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div>
                      <div className="text-xs text-slate-500">Customer ID</div>
                      <code className="text-sm text-slate-300">{selectedSubscription.customer_id}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(selectedSubscription.customer_id, 'cus_id')}
                      className="h-8 w-8 text-slate-400 hover:text-white"
                    >
                      {copied === 'cus_id' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</h3>
                <div className="flex gap-2">
                  {selectedSubscription.status === 'active' && (
                    <Button
                      variant="outline"
                      className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
                      onClick={() => pauseSubscription(selectedSubscription.id)}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  {selectedSubscription.status === 'paused' && (
                    <Button
                      variant="outline"
                      className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
                      onClick={() => resumeSubscription(selectedSubscription.id)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}
                  {!['canceled', 'incomplete_expired'].includes(selectedSubscription.status) && (
                    <Button
                      variant="outline"
                      className="flex-1 border-red-500/20 text-red-400 hover:bg-red-500/10"
                      onClick={() => cancelSubscription(selectedSubscription.id)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Timeline</h3>
                <div className="p-3 rounded-lg bg-white/5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Created</span>
                    <span className="text-white">{formatDate(selectedSubscription.created_at)}</span>
                  </div>
                  {selectedSubscription.canceled_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Canceled</span>
                      <span className="text-white">{formatDate(selectedSubscription.canceled_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
