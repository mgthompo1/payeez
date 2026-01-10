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
import { Search, Download, Filter, CreditCard, RefreshCw, X, Copy, Check } from 'lucide-react'

const getToday = () => new Date().toISOString().slice(0, 10)

const datePresets = [
  { label: 'Today', getValue: () => ({ start: getToday(), end: getToday() }) },
  { label: 'Yesterday', getValue: () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const v = d.toISOString().slice(0, 10)
    return { start: v, end: v }
  }},
  { label: 'Last 7 days', getValue: () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 6)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }},
  { label: 'Last 30 days', getValue: () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 29)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }},
  { label: 'Custom', getValue: () => ({ start: '', end: '' }) },
]

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [datePreset, setDatePreset] = useState('Today')
  const [attemptStart, setAttemptStart] = useState(getToday())
  const [attemptEnd, setAttemptEnd] = useState(getToday())
  const [sessionStart, setSessionStart] = useState('')
  const [sessionEnd, setSessionEnd] = useState('')
  const [selectedTx, setSelectedTx] = useState<any>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const preset = datePresets.find(p => p.label === datePreset)
    if (preset && datePreset !== 'Custom') {
      const { start, end } = preset.getValue()
      setAttemptStart(start)
      setAttemptEnd(end)
    }
  }, [datePreset])

  // Auto-load transactions on mount
  useEffect(() => {
    searchTransactions()
  }, [])

  const toStartOfDayIso = (value: string) => {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  const toEndOfDayIso = (value: string) => {
    const date = new Date(value)
    date.setHours(23, 59, 59, 999)
    return date.toISOString()
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const searchTransactions = async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('payment_attempts')
      .select(`
          id,
          amount,
          currency,
          status,
          psp,
          psp_transaction_id,
          created_at,
          captured_amount,
          refunded_amount,
          failure_code,
          failure_message,
          payment_method_type,
          wallet_type,
          idempotency_key,
          tokens (
            card_brand,
            card_last4,
            card_exp_month,
            card_exp_year
          ),
          payment_sessions (
            id,
            customer_email,
            external_id,
            created_at,
            metadata
          )
        `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (searchQuery) {
      query = query.or(
        `psp_transaction_id.ilike.%${searchQuery}%,id.eq.${searchQuery},payment_sessions.customer_email.ilike.%${searchQuery}%,payment_sessions.external_id.ilike.%${searchQuery}%`
      )
    }

    if (attemptStart) {
      query = query.gte('created_at', toStartOfDayIso(attemptStart))
    }

    if (attemptEnd) {
      query = query.lte('created_at', toEndOfDayIso(attemptEnd))
    }

    if (sessionStart) {
      query = query.gte('payment_sessions.created_at', toStartOfDayIso(sessionStart))
    }

    if (sessionEnd) {
      query = query.lte('payment_sessions.created_at', toEndOfDayIso(sessionEnd))
    }

    const { data, error } = await query

    if (!error && data) {
      setTransactions(data.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        psp: t.psp,
        psp_transaction_id: t.psp_transaction_id,
        customer_email: t.payment_sessions?.customer_email,
        created_at: t.created_at,
        captured_amount: t.captured_amount,
        refunded_amount: t.refunded_amount,
        failure_code: t.failure_code,
        failure_message: t.failure_message,
        payment_method_type: t.payment_method_type,
        wallet_type: t.wallet_type,
        idempotency_key: t.idempotency_key,
        card_brand: t.tokens?.card_brand,
        card_last4: t.tokens?.card_last4,
        card_exp_month: t.tokens?.card_exp_month,
        card_exp_year: t.tokens?.card_exp_year,
        session_id: t.payment_sessions?.id,
        external_id: t.payment_sessions?.external_id,
        metadata: t.payment_sessions?.metadata,
      })))
    }

    setLoading(false)
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      succeeded: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      captured: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      authorized: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return <Badge className={styles[status] || 'bg-gray-500/10 text-gray-400'}>{status}</Badge>
  }

  return (
    <div className="p-8 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Transactions</h1>
          <p className="text-slate-500 mt-1">View and search payment transactions</p>
        </div>
        <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-cyan-400">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="dashboard-card p-6">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search by transaction ID, email, or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-obsidian border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20"
              onKeyDown={(e) => e.key === 'Enter' && searchTransactions()}
            />
          </div>
          <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button
            onClick={searchTransactions}
            disabled={loading}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-medium"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              'Search'
            )}
          </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Date range</p>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 focus:ring-cyan-400/20"
              >
                {datePresets.map((preset) => (
                  <option key={preset.label} value={preset.label}>{preset.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Attempt date</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={attemptStart}
                  onChange={(e) => { setAttemptStart(e.target.value); setDatePreset('Custom') }}
                  className="bg-obsidian border-white/10 text-white focus:border-cyan-400 focus:ring-cyan-400/20"
                />
                <Input
                  type="date"
                  value={attemptEnd}
                  onChange={(e) => { setAttemptEnd(e.target.value); setDatePreset('Custom') }}
                  className="bg-obsidian border-white/10 text-white focus:border-cyan-400 focus:ring-cyan-400/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Session date</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={sessionStart}
                  onChange={(e) => setSessionStart(e.target.value)}
                  className="bg-obsidian border-white/10 text-white focus:border-cyan-400 focus:ring-cyan-400/20"
                />
                <Input
                  type="date"
                  value={sessionEnd}
                  onChange={(e) => setSessionEnd(e.target.value)}
                  className="bg-obsidian border-white/10 text-white focus:border-cyan-400 focus:ring-cyan-400/20"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
          <p className="text-sm text-slate-500">{transactions.length} transactions found</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Processor</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                        <CreditCard className="h-6 w-6 text-slate-500" />
                      </div>
                      <p className="text-slate-400 mb-2">No transactions found</p>
                      <p className="text-sm text-slate-500">Use the search to find specific transactions</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    onClick={() => setSelectedTx(transaction)}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-6">
                      <code className="text-sm text-cyan-400">{transaction.id.slice(0, 8)}...</code>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-white font-medium">{formatAmount(transaction.amount, transaction.currency)}</span>
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(transaction.status)}</td>
                    <td className="py-4 px-6">
                      <Badge className="bg-white/5 text-slate-300 border-white/10 group-hover:border-cyan-500/30 transition-all">{transaction.psp}</Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-400">{transaction.customer_email || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-500 text-sm">{formatDate(transaction.created_at)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Sheet */}
      <Sheet open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <SheetContent className="bg-charcoal border-white/10 w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white flex items-center justify-between">
              Transaction Details
            </SheetTitle>
          </SheetHeader>

          {selectedTx && (
            <div className="mt-6 space-y-6">
              {/* Status & Amount */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center justify-between mb-4">
                  {getStatusBadge(selectedTx.status)}
                  <span className="text-2xl font-bold text-white">
                    {formatAmount(selectedTx.amount, selectedTx.currency)}
                  </span>
                </div>
                {selectedTx.captured_amount > 0 && (
                  <div className="text-sm text-gray-400">
                    Captured: {formatAmount(selectedTx.captured_amount, selectedTx.currency)}
                  </div>
                )}
                {selectedTx.refunded_amount > 0 && (
                  <div className="text-sm text-red-400">
                    Refunded: {formatAmount(selectedTx.refunded_amount, selectedTx.currency)}
                  </div>
                )}
              </div>

              {/* IDs */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Identifiers</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div>
                      <div className="text-xs text-gray-500">Transaction ID</div>
                      <code className="text-sm text-cyan-400">{selectedTx.id}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(selectedTx.id, 'id')}
                      className="h-8 w-8 text-gray-400 hover:text-white"
                    >
                      {copied === 'id' ? <Check className="h-4 w-4 text-cyan-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  {selectedTx.psp_transaction_id && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <div>
                        <div className="text-xs text-gray-500">PSP Transaction ID</div>
                        <code className="text-sm text-white">{selectedTx.psp_transaction_id}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(selectedTx.psp_transaction_id, 'psp_id')}
                        className="h-8 w-8 text-gray-400 hover:text-white"
                      >
                        {copied === 'psp_id' ? <Check className="h-4 w-4 text-cyan-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                  {selectedTx.session_id && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <div>
                        <div className="text-xs text-gray-500">Session ID</div>
                        <code className="text-sm text-gray-300">{selectedTx.session_id}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(selectedTx.session_id, 'session')}
                        className="h-8 w-8 text-gray-400 hover:text-white"
                      >
                        {copied === 'session' ? <Check className="h-4 w-4 text-cyan-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                  {selectedTx.external_id && (
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-gray-500">External Reference</div>
                      <code className="text-sm text-gray-300">{selectedTx.external_id}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</h3>
                <div className="p-3 rounded-lg bg-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Processor</span>
                    <Badge className="bg-white/5 text-gray-300 border-white/10">{selectedTx.psp}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Type</span>
                    <span className="text-white">{selectedTx.wallet_type || selectedTx.payment_method_type || 'card'}</span>
                  </div>
                  {selectedTx.card_last4 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Card</span>
                      <span className="text-white">
                        {selectedTx.card_brand?.toUpperCase()} •••• {selectedTx.card_last4}
                        {selectedTx.card_exp_month && selectedTx.card_exp_year && (
                          <span className="text-gray-500 ml-2">
                            {selectedTx.card_exp_month}/{selectedTx.card_exp_year}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer */}
              {selectedTx.customer_email && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</h3>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-white">{selectedTx.customer_email}</div>
                  </div>
                </div>
              )}

              {/* Failure Info */}
              {selectedTx.failure_code && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Failure Details</h3>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
                    <div className="text-red-400 font-medium">{selectedTx.failure_code}</div>
                    {selectedTx.failure_message && (
                      <div className="text-sm text-red-300">{selectedTx.failure_message}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedTx.metadata && Object.keys(selectedTx.metadata).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</h3>
                  <div className="p-3 rounded-lg bg-white/5">
                    <pre className="text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(selectedTx.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Timeline</h3>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Created</span>
                    <span className="text-white text-sm">{formatDate(selectedTx.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}