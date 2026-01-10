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
  Check,
  Loader2
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
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { loadSubscriptions() }, [])

  const loadSubscriptions = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('subscriptions').select('*, customers(email, name), subscription_items(*, prices(*, products(name)))').order('created_at', { ascending: false })
    if (!error && data) setSubscriptions(data as Subscription[])
    setLoading(false)
  }

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = sub.customers?.email?.toLowerCase().includes(searchQuery.toLowerCase()) || sub.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const copyToClipboard = (text: string, field: string) => { navigator.clipboard.writeText(text); setCopied(field); setTimeout(() => setCopied(null), 2000) }
  const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100)
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status] || statusConfig.active
    const Icon = config.icon
    return <Badge className={`${config.color} gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-tighter`}><Icon className="h-3 w-3" />{config.label}</Badge>
  }

  const getMonthlyValue = (sub: Subscription) => {
    let total = 0
    sub.subscription_items?.forEach(item => {
      const price = item.prices
      if (price?.unit_amount) {
        let amount = price.unit_amount * item.quantity
        switch (price.recurring_interval) {
          case 'day': amount *= 30; break
          case 'week': amount *= 4; break
          case 'year': amount /= 12; break
        }
        total += amount
      }
    })
    return total
  }

  const cancelSubscription = async (subId: string) => {
    const supabase = createClient()
    await supabase.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', subId)
    loadSubscriptions()
    setSelectedSubscription(null)
  }

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Subscriptions</h1>
          <p className="text-slate-500 mt-1">Manage recurring institutional contracts.</p>
        </div>
      </div>

      <div className="dashboard-card p-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input placeholder="Search by customer or contract ref..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-obsidian border-white/10 text-white focus:border-cyan-400" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none min-w-[160px]">
          <option value="all">All Contracts</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="paused">Paused</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
          <h2 className="text-lg font-semibold text-white">Institutional Ledger</h2>
          <Badge variant="outline" className="bg-white/5 text-slate-400 border-white/10 font-mono text-[10px]">{filteredSubscriptions.length} ACTIVE</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                <th className="text-left py-4 px-6">Customer</th>
                <th className="text-left py-4 px-6">Status</th>
                <th className="text-left py-4 px-6">Plan Topology</th>
                <th className="text-left py-4 px-6">Yield (MRR)</th>
                <th className="text-left py-4 px-6">End of Cycle</th>
                <th className="text-right py-4 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="h-8 w-8 text-cyan-400 animate-spin mx-auto" /></td></tr>
              ) : filteredSubscriptions.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center text-slate-600 italic">No recurring data found.</td></tr>
              ) : filteredSubscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer group" onClick={() => setSelectedSubscription(sub)}>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center font-bold text-cyan-400">{(sub.customers?.name || sub.customers?.email || 'U').charAt(0).toUpperCase()}</div>
                      <div><span className="text-white font-medium group-hover:text-cyan-400 transition-colors">{sub.customers?.name || 'Unnamed'}</span><p className="text-xs text-slate-500">{sub.customers?.email}</p></div>
                    </div>
                  </td>
                  <td className="py-4 px-6"><StatusBadge status={sub.status} /></td>
                  <td className="py-4 px-6"><div className="space-y-1">{sub.subscription_items?.map(i => <p key={i.id} className="text-slate-300 text-sm">{i.prices?.products?.name}</p>)}</div></td>
                  <td className="py-4 px-6"><span className="text-white font-bold">{formatAmount(getMonthlyValue(sub), 'usd')}</span><span className="text-[10px] text-slate-600 ml-1">MRR</span></td>
                  <td className="py-4 px-6"><span className="text-slate-400 text-sm">{formatDate(sub.current_period_end)}</span></td>
                  <td className="py-4 px-6 text-right"><Button variant="ghost" size="icon" className="text-slate-500 group-hover:text-white rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!selectedSubscription} onOpenChange={() => setSelectedSubscription(null)}>
        <SheetContent className="bg-charcoal border-white/10 w-[500px] overflow-y-auto text-slate-300">
          <SheetHeader><SheetTitle className="text-white">Contract Intelligence</SheetTitle></SheetHeader>
          {selectedSubscription && (
            <div className="mt-8 space-y-6">
              <div className="dashboard-card bg-white/5 p-5 flex items-center justify-between border-white/5">
                <div><p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Normalized MRR</p><p className="text-3xl font-bold text-white tracking-tighter">{formatAmount(getMonthlyValue(selectedSubscription), 'usd')}</p></div>
                <StatusBadge status={selectedSubscription.status} />
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">End-User Reference</h3>
                <div className="dashboard-card bg-black/20 p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center"><User className="h-5 w-5 text-slate-400" /></div>
                  <div><p className="text-white font-medium">{selectedSubscription.customers?.name || 'Unnamed'}</p><p className="text-xs text-slate-500">{selectedSubscription.customers?.email}</p></div>
                </div>
              </div>
              <div className="pt-4 border-t border-white/10">
                <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-full h-11 shadow-lg shadow-cyan-500/20 transition-all">Manage Contract Lifecycle</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}