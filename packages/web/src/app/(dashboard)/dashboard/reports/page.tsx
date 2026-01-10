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

// ===== TYPES =====
type ReportType = 'transactions' | 'refunds' | 'settlements'

interface Settlement {
  id: string
  psp: string
  currency: string
  gross_amount: number
  fee_amount: number
  net_amount: number
  period_start: string
  period_end: string
  deposited_at: string
  status: string
  created_at: string
}

interface SettlementItem {
  id: string
  payment_attempt_id: string
  amount: number
  fee_amount: number
  net_amount: number
  created_at: string
}

// ===== EXPORT TAB =====

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
        let query = supabase.from('refunds').select('id, created_at, payment_attempt_id, amount, currency, status, reason, psp, psp_refund_id').order('created_at', { ascending: false }).limit(5000)
        if (startDate) query = query.gte('created_at', toStartOfDayIso(startDate))
        if (endDate) query = query.lte('created_at', toEndOfDayIso(endDate))
        const { data, error: queryError } = await query
        if (queryError) throw queryError
        const headers = ['id', 'created_at', 'payment_attempt_id', 'amount', 'currency', 'status', 'reason', 'psp', 'psp_refund_id']
        const rows = (data || []).map((row: any) => [row.id, row.created_at, row.payment_attempt_id, row.amount, row.currency, row.status, row.reason, row.psp, row.psp_refund_id])
        downloadCsv(filename, buildCsv(headers, rows))
      }
      if (reportType === 'settlements') {
        let query = supabase.from('settlements').select('id, created_at, deposited_at, psp, currency, gross_amount, fee_amount, net_amount, status, period_start, period_end').order('deposited_at', { ascending: false }).limit(5000)
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
    <div className="dashboard-card p-6 space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-bold text-slate-500">Report type</p>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="h-10 w-full rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none transition-all"
          >
            <option value="transactions">Transactions</option>
            <option value="refunds">Refunds</option>
            <option value="settlements">Settlements</option>
          </select>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-bold text-slate-500">Date preset</p>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none transition-all"
          >
            {datePresets.map((preset) => (
              <option key={preset.label} value={preset.label}>{preset.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-bold text-slate-500">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset('All time') }} className="bg-obsidian border-white/10 text-white focus:border-cyan-400 h-10" />
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset('All time') }} className="bg-obsidian border-white/10 text-white focus:border-cyan-400 h-10" />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <p className="text-xs text-slate-500 italic">Exports are limited to 5,000 rows per dispatch.</p>
        <Button onClick={handleDownload} disabled={loading} className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold rounded-full px-8 h-11 shadow-lg shadow-cyan-500/20 transition-all">
          {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing...</>) : (<><Download className="h-4 w-4 mr-2" />Download CSV</>)}
        </Button>
      </div>
    </div>
  )
}

// ===== RECONCILIATION TAB =====
const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  reconciled: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
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
      <div className="dashboard-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
          <Search className="h-3 w-3" />Filters
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Status</p>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none">
              <option value="all">All</option>
              {['pending', 'paid', 'failed', 'reconciled'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">PSP</p>
            <select value={pspFilter} onChange={(e) => setPspFilter(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none">
              <option value="all">All</option>
              {['stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex', 'windcave'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Date preset</p>
            <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none">
              {datePresets.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Start</p>
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset('All time') }} className="bg-obsidian border-white/10 text-white focus:border-cyan-400 h-10" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">End</p>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset('All time') }} className="bg-obsidian border-white/10 text-white focus:border-cyan-400 h-10" />
          </div>
        </div>
        <Button onClick={loadSettlements} disabled={loading} className="w-full sm:w-auto bg-white text-black hover:bg-slate-200 rounded-full h-10 px-8 font-medium">
          {loading ? 'Processing...' : 'Apply Filters'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="dashboard-card overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Settlement Registry</h2>
            <p className="text-sm text-slate-500">{settlements.length} disbursements tracked</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                  <th className="text-left py-4 px-6">Reference</th>
                  <th className="text-left py-4 px-6">Processor</th>
                  <th className="text-left py-4 px-6">Net Yield</th>
                  <th className="text-left py-4 px-6">Status</th>
                  <th className="text-right py-4 px-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {settlements.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-600 italic">No settlement data matches current filters.</td></tr>
                ) : settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-mono text-cyan-400/80">{s.id.slice(0, 8)}...</td>
                    <td className="px-6 py-4 text-slate-300 font-medium capitalize">{s.psp}</td>
                    <td className="px-6 py-4 text-white font-semibold">{formatAmount(s.net_amount, s.currency)}</td>
                    <td className="px-6 py-4"><Badge className={`${statusStyles[s.status] || 'bg-white/5 text-slate-400'} rounded-full font-bold text-[10px] uppercase`}>{s.status}</Badge></td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="ghost" className="text-cyan-400 hover:bg-cyan-400/10 rounded-full h-8 px-4" onClick={() => loadSettlementItems(s)}>Inspect</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Financial Audit</h2>
            <p className="text-sm text-slate-500">Verification and reconciliation engine.</p>
          </div>

          {!selectedSettlement ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <Scale className="h-8 w-8 text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Select a row to begin audit.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-obsidian p-5 space-y-4 shadow-xl">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Accounting Period</p>
                  <div className="text-sm text-slate-200 font-medium">{formatDate(selectedSettlement.period_start)} — {formatDate(selectedSettlement.period_end)}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Net Disbursement</p>
                  <div className="text-3xl font-bold text-white tracking-tight">{formatAmount(selectedSettlement.net_amount, selectedSettlement.currency)}</div>
                </div>
                <Badge className={`${statusStyles[selectedSettlement.status] || 'bg-white/5 text-slate-400'} rounded-full py-1 px-3`}>{selectedSettlement.status}</Badge>
              </div>

              {selectedSettlement.status !== 'reconciled' && (
                <Button onClick={markReconciled} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-11 rounded-full shadow-lg shadow-cyan-500/20 transition-all">
                  <CheckCircle2 className="h-4 w-4 mr-2" />Finalize Reconciliation
                </Button>
              )}

              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest font-bold text-slate-500">Component Transactions</h3>
                {itemsLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 text-cyan-400 animate-spin" /></div>
                ) : settlementItems.length === 0 ? (
                  <p className="text-sm text-slate-600 italic">No breakdown available.</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
                    {settlementItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-white/10 transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Attempt Ref</p>
                            <code className="text-xs text-cyan-400/80 font-mono">{item.payment_attempt_id?.slice(0, 16) || 'N/A'}...</code>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Status</p>
                            <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-400/10 rounded">SETTLED</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5 text-[11px]">
                          <div className="space-y-0.5">
                            <p className="text-slate-500 font-medium">Gross</p>
                            <p className="text-slate-200 font-bold">{formatAmount(item.amount, selectedSettlement.currency)}</p>
                          </div>
                          <div className="space-y-0.5 text-center">
                            <p className="text-slate-500 font-medium">Fee</p>
                            <p className="text-red-400 font-bold">{formatAmount(item.fee_amount, selectedSettlement.currency)}</p>
                          </div>
                          <div className="space-y-0.5 text-right">
                            <p className="text-slate-500 font-medium">Net</p>
                            <p className="text-emerald-400 font-bold">{formatAmount(item.net_amount, selectedSettlement.currency)}</p>
                          </div>
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
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="dashboard-heading text-2xl">Financial Reports</h1>
        <p className="text-slate-500 mt-1">Export transaction logs and reconcile processor disbursements.</p>
      </div>

      <Tabs defaultValue="export" className="space-y-8">
        <TabsList className="dashboard-card p-1 h-12 w-fit rounded-2xl border-white/10 bg-charcoal/50">
          <TabsTrigger value="export" className="data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg text-slate-400 h-full px-6 rounded-xl font-medium transition-all">
            <FileText className="h-4 w-4 mr-2" />Data Export
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg text-slate-400 h-full px-6 rounded-xl font-medium transition-all">
            <Scale className="h-4 w-4 mr-2" />Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="outline-none">
          <ExportTab />
        </TabsContent>

        <TabsContent value="reconciliation" className="outline-none">
          <ReconciliationTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}