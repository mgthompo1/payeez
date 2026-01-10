"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, FileText, Loader2, CheckCircle2, RefreshCw, Search, Scale } from 'lucide-react'

// ===== SHARED =====
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
  { label: 'All time', getValue: () => ({ start: '', end: '' }) },
]

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

// ===== EXPORT TAB =====
type ReportType = 'transactions' | 'refunds' | 'settlements'

const reportLabels: Record<ReportType, string> = {
  transactions: 'Transactions',
  refunds: 'Refunds',
  settlements: 'Settlements',
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function ExportTab() {
  const [reportType, setReportType] = useState<ReportType>('transactions')
  const [datePreset, setDatePreset] = useState('Today')
  const [startDate, setStartDate] = useState(getToday())
  const [endDate, setEndDate] = useState(getToday())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const preset = datePresets.find(p => p.label === datePreset)
    if (preset && datePreset !== 'All time') {
      const { start, end } = preset.getValue()
      setStartDate(start)
      setEndDate(end)
    }
  }, [datePreset])

  const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const buildCsv = (headers: string[], rows: Array<Array<unknown>>) => {
    const lines = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ]
    return `${lines.join('\n')}\n`
  }

  const handleDownload = async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const now = new Date().toISOString().slice(0, 10)
    const filename = `atlas_${reportType}_${startDate || 'all'}_${endDate || now}.csv`

    try {
      if (reportType === 'transactions') {
        let query = supabase
          .from('payment_attempts')
          .select(`id, created_at, amount, currency, status, psp, psp_transaction_id, captured_amount, refunded_amount, payment_sessions (external_id, customer_email)`)
          .order('created_at', { ascending: false })
          .limit(5000)

        if (startDate) query = query.gte('created_at', toStartOfDayIso(startDate))
        if (endDate) query = query.lte('created_at', toEndOfDayIso(endDate))

        const { data, error: queryError } = await query
        if (queryError) throw queryError

        const headers = ['id', 'created_at', 'amount', 'currency', 'status', 'psp', 'psp_transaction_id', 'captured_amount', 'refunded_amount', 'session_external_id', 'customer_email']
        const rows = (data || []).map((row: any) => [row.id, row.created_at, row.amount, row.currency, row.status, row.psp, row.psp_transaction_id, row.captured_amount ?? 0, row.refunded_amount ?? 0, row.payment_sessions?.external_id, row.payment_sessions?.customer_email])
        downloadCsv(filename, buildCsv(headers, rows))
      }

      if (reportType === 'refunds') {
        let query = supabase
          .from('refunds')
          .select('id, created_at, payment_attempt_id, amount, currency, status, reason, psp, psp_refund_id')
          .order('created_at', { ascending: false })
          .limit(5000)

        if (startDate) query = query.gte('created_at', toStartOfDayIso(startDate))
        if (endDate) query = query.lte('created_at', toEndOfDayIso(endDate))

        const { data, error: queryError } = await query
        if (queryError) throw queryError

        const headers = ['id', 'created_at', 'payment_attempt_id', 'amount', 'currency', 'status', 'reason', 'psp', 'psp_refund_id']
        const rows = (data || []).map((row: any) => [row.id, row.created_at, row.payment_attempt_id, row.amount, row.currency, row.status, row.reason, row.psp, row.psp_refund_id])
        downloadCsv(filename, buildCsv(headers, rows))
      }

      if (reportType === 'settlements') {
        let query = supabase
          .from('settlements')
          .select('id, created_at, deposited_at, psp, currency, gross_amount, fee_amount, net_amount, status, period_start, period_end')
          .order('deposited_at', { ascending: false })
          .limit(5000)

        if (startDate) query = query.gte('deposited_at', toStartOfDayIso(startDate))
        if (endDate) query = query.lte('deposited_at', toEndOfDayIso(endDate))

        const { data, error: queryError } = await query
        if (queryError) throw queryError

        const headers = ['id', 'created_at', 'deposited_at', 'psp', 'currency', 'gross_amount', 'fee_amount', 'net_amount', 'status', 'period_start', 'period_end']
        const rows = (data || []).map((row: any) => [row.id, row.created_at, row.deposited_at, row.psp, row.currency, row.gross_amount, row.fee_amount, row.net_amount, row.status, row.period_start, row.period_end])
        downloadCsv(filename, buildCsv(headers, rows))
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to export report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-[#111] border border-white/10 p-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">Report type</p>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white"
          >
            <option value="transactions">Transactions</option>
            <option value="refunds">Refunds</option>
            <option value="settlements">Settlements</option>
          </select>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">Date preset</p>
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
          <p className="text-xs uppercase tracking-wide text-gray-500">Date range</p>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset('All time') }} className="bg-[#0a0a0a] border-white/10 text-white" />
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset('All time') }} className="bg-[#0a0a0a] border-white/10 text-white" />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Exports are limited to 5,000 rows per download.</p>
        <Button onClick={handleDownload} disabled={loading} className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
          {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing...</>) : (<><Download className="h-4 w-4 mr-2" />Download CSV</>)}
        </Button>
      </div>
    </div>
  )
}

// ===== RECONCILIATION TAB =====
type Settlement = {
  id: string
  psp: string
  currency: string
  gross_amount: number
  fee_amount: number
  net_amount: number
  period_start: string | null
  period_end: string | null
  deposited_at: string | null
  status: string
  created_at: string
}

type SettlementItem = {
  id: string
  payment_attempt_id: string | null
  amount: number
  fee_amount: number
  net_amount: number
  created_at: string
}

const pspOptions = ['stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex', 'windcave']
const statusOptions = ['pending', 'paid', 'failed', 'reconciled']
const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  paid: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  reconciled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

function ReconciliationTab() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [settlementItems, setSettlementItems] = useState<SettlementItem[]>([])
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [loading, setLoading] = useState(false)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [pspFilter, setPspFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('Last 30 days')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    const preset = datePresets.find(p => p.label === datePreset)
    if (preset) {
      const { start, end } = preset.getValue()
      setStartDate(start)
      setEndDate(end)
    }
  }, [datePreset])

  const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount / 100)
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : '-'

  const loadSettlements = async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('settlements').select('id, psp, currency, gross_amount, fee_amount, net_amount, period_start, period_end, deposited_at, status, created_at').order('deposited_at', { ascending: false }).limit(50)

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (pspFilter !== 'all') query = query.eq('psp', pspFilter)
    if (startDate) query = query.gte('deposited_at', toStartOfDayIso(startDate))
    if (endDate) query = query.lte('deposited_at', toEndOfDayIso(endDate))

    const { data } = await query
    setSettlements(data || [])
    setLoading(false)
  }

  const loadSettlementItems = async (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setItemsLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('settlement_items').select('id, payment_attempt_id, amount, fee_amount, net_amount, created_at').eq('settlement_id', settlement.id).order('created_at', { ascending: false })
    setSettlementItems(data || [])
    setItemsLoading(false)
  }

  const markReconciled = async () => {
    if (!selectedSettlement) return
    const supabase = createClient()
    const { error } = await supabase.from('settlements').update({ status: 'reconciled' }).eq('id', selectedSettlement.id)
    if (!error) {
      const updated = { ...selectedSettlement, status: 'reconciled' }
      setSelectedSettlement(updated)
      setSettlements((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    }
  }

  useEffect(() => { loadSettlements() }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#111] border border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
          <Search className="h-4 w-4" />Filters
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white">
              <option value="all">All</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">PSP</p>
            <select value={pspFilter} onChange={(e) => setPspFilter(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white">
              <option value="all">All</option>
              {pspOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Date preset</p>
            <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white">
              {datePresets.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Start</p>
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset('All time') }} className="bg-[#0a0a0a] border-white/10 text-white" />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">End</p>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset('All time') }} className="bg-[#0a0a0a] border-white/10 text-white" />
          </div>
        </div>
        <Button onClick={loadSettlements} disabled={loading} className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
          {loading ? 'Loading...' : 'Apply filters'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Settlements</h2>
            <p className="text-sm text-gray-500">{settlements.length} settlements</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="text-left py-3 px-6 text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left py-3 px-6 text-xs uppercase tracking-wider">PSP</th>
                  <th className="text-left py-3 px-6 text-xs uppercase tracking-wider">Net</th>
                  <th className="text-left py-3 px-6 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-6 text-xs uppercase tracking-wider">View</th>
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-500">No settlements yet.</td></tr>
                ) : settlements.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-6 py-3 text-gray-300">{s.id.slice(0, 8)}...</td>
                    <td className="px-6 py-3 text-gray-300">{s.psp}</td>
                    <td className="px-6 py-3 text-gray-300">{formatAmount(s.net_amount, s.currency)}</td>
                    <td className="px-6 py-3"><Badge className={statusStyles[s.status] || 'bg-white/5 text-gray-300'}>{s.status}</Badge></td>
                    <td className="px-6 py-3 text-right">
                      <Button size="sm" variant="ghost" className="text-[#19d1c3] hover:text-[#c8ff5a]" onClick={() => loadSettlementItems(s)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-[#111] border border-white/10 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Settlement details</h2>
            <p className="text-sm text-gray-500">Inspect line items and reconcile.</p>
          </div>

          {!selectedSettlement ? (
            <div className="text-sm text-gray-500">Select a settlement to view details.</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="text-xs text-gray-500">Period</div>
                <div className="text-sm text-white">{formatDate(selectedSettlement.period_start)} - {formatDate(selectedSettlement.period_end)}</div>
                <div className="text-xs text-gray-500">Net deposit</div>
                <div className="text-xl font-semibold text-white">{formatAmount(selectedSettlement.net_amount, selectedSettlement.currency)}</div>
                <Badge className={statusStyles[selectedSettlement.status] || 'bg-white/5 text-gray-300'}>{selectedSettlement.status}</Badge>
              </div>

              {selectedSettlement.status !== 'reconciled' && (
                <Button onClick={markReconciled} className="w-full bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
                  <CheckCircle2 className="h-4 w-4 mr-2" />Mark as reconciled
                </Button>
              )}

              <div className="space-y-2">
                <div className="text-sm font-semibold text-white">Settlement items</div>
                {itemsLoading ? (
                  <div className="text-sm text-gray-500">Loading...</div>
                ) : settlementItems.length === 0 ? (
                  <div className="text-sm text-gray-500">No items recorded.</div>
                ) : (
                  <div className="space-y-3 max-h-[320px] overflow-auto pr-1">
                    {settlementItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-[#0a0a0a] p-3">
                        <div className="text-xs text-gray-500">Payment</div>
                        <div className="text-sm text-white">{item.payment_attempt_id || 'Unknown'}</div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-400">
                          <div>Gross: <span className="text-gray-200">{formatAmount(item.amount, selectedSettlement.currency)}</span></div>
                          <div>Fees: <span className="text-gray-200">{formatAmount(item.fee_amount, selectedSettlement.currency)}</span></div>
                          <div>Net: <span className="text-gray-200">{formatAmount(item.net_amount, selectedSettlement.currency)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== MAIN PAGE =====
export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-gray-500 mt-1">Export data and reconcile settlements.</p>
      </div>

      <Tabs defaultValue="export" className="space-y-6">
        <TabsList className="bg-[#111] border border-white/10 p-1">
          <TabsTrigger value="export" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            <FileText className="h-4 w-4 mr-2" />Export
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            <Scale className="h-4 w-4 mr-2" />Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <ExportTab />
        </TabsContent>

        <TabsContent value="reconciliation">
          <ReconciliationTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
