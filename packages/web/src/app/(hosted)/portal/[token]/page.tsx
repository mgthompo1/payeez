'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  CreditCard,
  FileText,
  ArrowLeft,
  AlertCircle,
  Calendar,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Download,
  ChevronRight
} from 'lucide-react'

interface Subscription {
  id: string
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at: string | null
  subscription_items: Array<{
    id: string
    quantity: number
    prices: {
      id: string
      unit_amount: number
      currency: string
      recurring_interval: string
      products: {
        name: string
      }
    }
  }>
}

interface Invoice {
  id: string
  status: string
  amount_due: number
  amount_paid: number
  currency: string
  created_at: string
  due_date: string | null
  hosted_invoice_url: string | null
}

interface PortalSession {
  id: string
  customer_id: string
  return_url: string
  allow_subscription_cancel: boolean
  allow_subscription_pause: boolean
  allow_payment_method_update: boolean
  allow_invoice_history: boolean
  expires_at: string
  customers: {
    id: string
    email: string
    name: string | null
  }
}

export default function PortalPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [session, setSession] = useState<PortalSession | null>(null)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices' | 'payment'>('subscriptions')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadPortalData()
  }, [token])

  const loadPortalData = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Load portal session
      const { data: portalSession, error: sessionError } = await supabase
        .from('portal_sessions')
        .select(`
          *,
          customers (
            id,
            email,
            name
          )
        `)
        .eq('id', token)
        .single()

      if (sessionError || !portalSession) {
        setError('Portal session not found or invalid')
        setLoading(false)
        return
      }

      // Check if expired
      if (new Date(portalSession.expires_at) < new Date()) {
        setError('This portal session has expired')
        setLoading(false)
        return
      }

      setSession(portalSession)

      // Load subscriptions
      const { data: subs } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_items (
            id,
            quantity,
            prices (
              id,
              unit_amount,
              currency,
              recurring_interval,
              products (
                name
              )
            )
          )
        `)
        .eq('customer_id', portalSession.customer_id)
        .order('created_at', { ascending: false })

      setSubscriptions(subs || [])

      // Load invoices if allowed
      if (portalSession.allow_invoice_history) {
        const { data: invs } = await supabase
          .from('invoices')
          .select('*')
          .eq('customer_id', portalSession.customer_id)
          .order('created_at', { ascending: false })
          .limit(20)

        setInvoices(invs || [])
      }
    } catch (err) {
      setError('Failed to load portal data')
    }

    setLoading(false)
  }

  const formatAmount = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-500/10 text-green-400 border-green-500/20',
      trialing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      past_due: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      canceled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      paused: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      paid: 'bg-green-500/10 text-green-400 border-green-500/20',
      open: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      void: 'bg-red-500/10 text-red-400 border-red-500/20',
    }

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || styles.draft}`}>
        {status}
      </span>
    )
  }

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription? It will remain active until the end of the current billing period.')) {
      return
    }

    setActionLoading(subscriptionId)

    try {
      const supabase = createClient()

      await supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)

      await loadPortalData()
    } catch (err) {
      alert('Failed to cancel subscription')
    }

    setActionLoading(null)
  }

  const handlePauseSubscription = async (subscriptionId: string) => {
    setActionLoading(subscriptionId)

    try {
      const supabase = createClient()

      await supabase
        .from('subscriptions')
        .update({
          status: 'paused',
          pause_collection: { behavior: 'void' }
        })
        .eq('id', subscriptionId)

      await loadPortalData()
    } catch (err) {
      alert('Failed to pause subscription')
    }

    setActionLoading(null)
  }

  const handleResumeSubscription = async (subscriptionId: string) => {
    setActionLoading(subscriptionId)

    try {
      const supabase = createClient()

      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          pause_collection: null
        })
        .eq('id', subscriptionId)

      await loadPortalData()
    } catch (err) {
      alert('Failed to resume subscription')
    }

    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto">
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Portal Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => window.location.href = session?.return_url || '/'}
          className="text-gray-400 hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {new URL(session?.return_url || 'https://example.com').hostname}
        </Button>

        <h1 className="text-2xl font-bold text-white">Billing Portal</h1>
        <p className="text-gray-400 mt-1">
          Manage your subscriptions and billing for {session?.customers?.email}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
        <Button
          variant={activeTab === 'subscriptions' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('subscriptions')}
          className={activeTab === 'subscriptions' ? 'bg-violet-500' : 'text-gray-400'}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Subscriptions
        </Button>
        {session?.allow_invoice_history && (
          <Button
            variant={activeTab === 'invoices' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('invoices')}
            className={activeTab === 'invoices' ? 'bg-violet-500' : 'text-gray-400'}
          >
            <FileText className="h-4 w-4 mr-2" />
            Invoices
          </Button>
        )}
        {session?.allow_payment_method_update && (
          <Button
            variant={activeTab === 'payment' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('payment')}
            className={activeTab === 'payment' ? 'bg-violet-500' : 'text-gray-400'}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Method
          </Button>
        )}
      </div>

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          {subscriptions.length === 0 ? (
            <div className="rounded-2xl bg-[#111] border border-white/10 p-8 text-center">
              <CreditCard className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">No Active Subscriptions</h2>
              <p className="text-gray-400">You don't have any active subscriptions.</p>
            </div>
          ) : (
            subscriptions.map((sub) => (
              <div key={sub.id} className="rounded-2xl bg-[#111] border border-white/10 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white">
                        {sub.subscription_items[0]?.prices?.products?.name || 'Subscription'}
                      </h3>
                      {getStatusBadge(sub.status)}
                    </div>
                    <p className="text-gray-400 text-sm">
                      {formatAmount(
                        sub.subscription_items.reduce((sum, item) =>
                          sum + (item.prices?.unit_amount || 0) * item.quantity, 0
                        ),
                        sub.subscription_items[0]?.prices?.currency
                      )}
                      {' / '}
                      {sub.subscription_items[0]?.prices?.recurring_interval || 'month'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="text-xs text-gray-500 mb-1">Current Period</div>
                    <div className="text-sm text-white">
                      {formatDate(sub.current_period_start)} - {formatDate(sub.current_period_end)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="text-xs text-gray-500 mb-1">Next Billing</div>
                    <div className="text-sm text-white">
                      {sub.cancel_at_period_end ? (
                        <span className="text-red-400">Cancels on {formatDate(sub.current_period_end)}</span>
                      ) : sub.status === 'paused' ? (
                        <span className="text-orange-400">Paused</span>
                      ) : (
                        formatDate(sub.current_period_end)
                      )}
                    </div>
                  </div>
                </div>

                {/* Subscription Items */}
                <div className="border-t border-white/10 pt-4 mb-4">
                  <div className="text-xs text-gray-500 mb-2">Items</div>
                  {sub.subscription_items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2">
                      <span className="text-white">
                        {item.prices?.products?.name || 'Item'}
                        {item.quantity > 1 && ` × ${item.quantity}`}
                      </span>
                      <span className="text-gray-400">
                        {formatAmount(item.prices?.unit_amount || 0, item.prices?.currency)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {sub.status === 'paused' && session?.allow_subscription_pause && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResumeSubscription(sub.id)}
                      disabled={actionLoading === sub.id}
                      className="border-white/10 text-white hover:bg-white/5"
                    >
                      {actionLoading === sub.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Resume
                    </Button>
                  )}
                  {sub.status === 'active' && session?.allow_subscription_pause && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePauseSubscription(sub.id)}
                      disabled={actionLoading === sub.id}
                      className="border-white/10 text-white hover:bg-white/5"
                    >
                      {actionLoading === sub.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Pause className="h-4 w-4 mr-2" />
                      )}
                      Pause
                    </Button>
                  )}
                  {!sub.cancel_at_period_end && sub.status !== 'canceled' && session?.allow_subscription_cancel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelSubscription(sub.id)}
                      disabled={actionLoading === sub.id}
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                      {actionLoading === sub.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && session?.allow_invoice_history && (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="rounded-2xl bg-[#111] border border-white/10 p-8 text-center">
              <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">No Invoices</h2>
              <p className="text-gray-400">You don't have any invoices yet.</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-white/5 last:border-0">
                      <td className="px-6 py-4 text-white">
                        {formatDate(invoice.created_at)}
                      </td>
                      <td className="px-6 py-4 text-white">
                        {formatAmount(invoice.amount_due, invoice.currency)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-white"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payment Method Tab */}
      {activeTab === 'payment' && session?.allow_payment_method_update && (
        <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Payment Method</h2>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-4 mb-6">
            <div className="h-10 w-14 rounded bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">VISA</span>
            </div>
            <div className="flex-1">
              <div className="text-white">•••• •••• •••• 4242</div>
              <div className="text-sm text-gray-500">Expires 12/28</div>
            </div>
            <CheckCircle className="h-5 w-5 text-green-400" />
          </div>

          <div className="rounded-xl bg-[#0a0a0a] border border-white/10 p-4">
            <div className="text-sm text-gray-400 mb-4">
              Update your payment method by entering new card details below.
            </div>

            {/* Card form placeholder */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-gray-400 text-xs">Card number</label>
                <div className="h-10 rounded-md bg-white/5 border border-white/10 px-3 flex items-center">
                  <span className="text-gray-500 text-sm">•••• •••• •••• ••••</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-gray-400 text-xs">Expiry</label>
                  <div className="h-10 rounded-md bg-white/5 border border-white/10 px-3 flex items-center">
                    <span className="text-gray-500 text-sm">MM/YY</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-gray-400 text-xs">CVC</label>
                  <div className="h-10 rounded-md bg-white/5 border border-white/10 px-3 flex items-center">
                    <span className="text-gray-500 text-sm">•••</span>
                  </div>
                </div>
              </div>
            </div>

            <Button
              className="w-full mt-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90"
            >
              Update Payment Method
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
