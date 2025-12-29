'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Filter, CreditCard, RefreshCw } from 'lucide-react'

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

  useEffect(() => {
    const preset = datePresets.find(p => p.label === datePreset)
    if (preset && datePreset !== 'Custom') {
      const { start, end } = preset.getValue()
      setAttemptStart(start)
      setAttemptEnd(end)
    }
  }, [datePreset])

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
          payment_sessions (
            customer_email,
            external_id,
            created_at
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
        customer_email: t.payment_sessions?.customer_email,
        created_at: t.created_at,
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
      succeeded: 'bg-green-500/10 text-green-400 border-green-500/20',
      captured: 'bg-green-500/10 text-green-400 border-green-500/20',
      authorized: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return <Badge className={styles[status] || 'bg-gray-500/10 text-gray-400'}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-gray-500 mt-1">View and search payment transactions</p>
        </div>
        <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search by transaction ID, email, or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
              onKeyDown={(e) => e.key === 'Enter' && searchTransactions()}
            />
          </div>
          <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button
            onClick={searchTransactions}
            disabled={loading}
            className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
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
              <p className="text-xs uppercase tracking-wide text-gray-500">Date range</p>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white"
              >
                {datePresets.map((preset) => (
                  <option key={preset.label} value={preset.label}>{preset.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">Attempt date</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={attemptStart}
                  onChange={(e) => { setAttemptStart(e.target.value); setDatePreset('Custom') }}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
                <Input
                  type="date"
                  value={attemptEnd}
                  onChange={(e) => { setAttemptEnd(e.target.value); setDatePreset('Custom') }}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">Session date</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={sessionStart}
                  onChange={(e) => setSessionStart(e.target.value)}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
                <Input
                  type="date"
                  value={sessionEnd}
                  onChange={(e) => setSessionEnd(e.target.value)}
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
          <p className="text-sm text-gray-500">{transactions.length} transactions found</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Processor</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                        <CreditCard className="h-6 w-6 text-gray-500" />
                      </div>
                      <p className="text-gray-400 mb-2">No transactions found</p>
                      <p className="text-sm text-gray-500">Use the search to find specific transactions</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6">
                      <code className="text-sm text-[#19d1c3]">{transaction.id.slice(0, 8)}...</code>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-white font-medium">{formatAmount(transaction.amount, transaction.currency)}</span>
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(transaction.status)}</td>
                    <td className="py-4 px-6">
                      <Badge className="bg-white/5 text-gray-300 border-white/10">{transaction.psp}</Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-400">{transaction.customer_email || '-'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-500 text-sm">{formatDate(transaction.created_at)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
