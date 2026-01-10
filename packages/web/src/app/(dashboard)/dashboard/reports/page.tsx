"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Download, FileText, Loader2 } from 'lucide-react'

type ReportType = 'transactions' | 'refunds' | 'settlements'

const reportLabels: Record<ReportType, string> = {
  transactions: 'Transactions',
  refunds: 'Refunds',
  settlements: 'Settlements',
}

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

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toStartOfDayIso(value: string) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function toEndOfDayIso(value: string) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date.toISOString()
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('transactions')
  const [datePreset, setDatePreset] = useState('Today')
  const [startDate, setStartDate] = useState(getToday())
  const [endDate, setEndDate] = useState(getToday())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const preset = datePresets.find(p => p.label === datePreset)
    if (preset && datePreset !== 'Custom') {
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
          .select(`
            id,
            created_at,
            amount,
            currency,
            status,
            psp,
            psp_transaction_id,
            captured_amount,
            refunded_amount,
            payment_sessions (
              external_id,
              customer_email
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5000)

        if (startDate) query = query.gte('created_at', toStartOfDayIso(startDate))
        if (endDate) query = query.lte('created_at', toEndOfDayIso(endDate))

        const { data, error: queryError } = await query
        if (queryError) throw queryError

        const headers = [
          'id',
          'created_at',
          'amount',
          'currency',
          'status',
          'psp',
          'psp_transaction_id',
          'captured_amount',
          'refunded_amount',
          'session_external_id',
          'customer_email',
        ]
        const rows = (data || []).map((row: any) => [
          row.id,
          row.created_at,
          row.amount,
          row.currency,
          row.status,
          row.psp,
          row.psp_transaction_id,
          row.captured_amount ?? 0,
          row.refunded_amount ?? 0,
          row.payment_sessions?.external_id,
          row.payment_sessions?.customer_email,
        ])

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

        const headers = [
          'id',
          'created_at',
          'payment_attempt_id',
          'amount',
          'currency',
          'status',
          'reason',
          'psp',
          'psp_refund_id',
        ]
        const rows = (data || []).map((row: any) => [
          row.id,
          row.created_at,
          row.payment_attempt_id,
          row.amount,
          row.currency,
          row.status,
          row.reason,
          row.psp,
          row.psp_refund_id,
        ])

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

        const headers = [
          'id',
          'created_at',
          'deposited_at',
          'psp',
          'currency',
          'gross_amount',
          'fee_amount',
          'net_amount',
          'status',
          'period_start',
          'period_end',
        ]
        const rows = (data || []).map((row: any) => [
          row.id,
          row.created_at,
          row.deposited_at,
          row.psp,
          row.currency,
          row.gross_amount,
          row.fee_amount,
          row.net_amount,
          row.status,
          row.period_start,
          row.period_end,
        ])

        downloadCsv(filename, buildCsv(headers, rows))
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to export report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-gray-500 mt-1">Generate CSV exports on demand.</p>
        </div>
        <Badge className="bg-white/5 text-gray-300 border-white/10 flex items-center gap-2">
          <FileText className="h-3 w-3" />
          {reportLabels[reportType]}
        </Badge>
      </div>

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
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDatePreset('Custom') }}
                className="bg-[#0a0a0a] border-white/10 text-white"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDatePreset('Custom') }}
                className="bg-[#0a0a0a] border-white/10 text-white"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Exports are limited to 5,000 rows per download.</p>
          <Button
            onClick={handleDownload}
            disabled={loading}
            className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
