'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, RefreshCw, Search } from 'lucide-react'

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

const pspOptions = ['stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex']
const statusOptions = ['pending', 'paid', 'failed', 'reconciled']

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  paid: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  reconciled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

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

export default function ReconciliationPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [settlementItems, setSettlementItems] = useState<SettlementItem[]>([])
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [loading, setLoading] = useState(false)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [pspFilter, setPspFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount / 100)
  }

  const formatDate = (value?: string | null) => {
    if (!value) return '-'
    return new Date(value).toLocaleDateString()
  }

  const loadSettlements = async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('settlements')
      .select('id, psp, currency, gross_amount, fee_amount, net_amount, period_start, period_end, deposited_at, status, created_at')
      .order('deposited_at', { ascending: false })
      .limit(50)

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (pspFilter !== 'all') {
      query = query.eq('psp', pspFilter)
    }

    if (startDate) {
      query = query.gte('deposited_at', toStartOfDayIso(startDate))
    }

    if (endDate) {
      query = query.lte('deposited_at', toEndOfDayIso(endDate))
    }

    const { data, error } = await query
    if (!error && data) {
      setSettlements(data)
    }
    setLoading(false)
  }

  const loadSettlementItems = async (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setItemsLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('settlement_items')
      .select('id, payment_attempt_id, amount, fee_amount, net_amount, created_at')
      .eq('settlement_id', settlement.id)
      .order('created_at', { ascending: false })

    setSettlementItems(data || [])
    setItemsLoading(false)
  }

  const markReconciled = async () => {
    if (!selectedSettlement) return
    const supabase = createClient()
    const { error } = await supabase
      .from('settlements')
      .update({ status: 'reconciled' })
      .eq('id', selectedSettlement.id)

    if (!error) {
      const updated = { ...selectedSettlement, status: 'reconciled' }
      setSelectedSettlement(updated)
      setSettlements((prev) => prev.map((settlement) => (
        settlement.id === updated.id ? updated : settlement
      )))
    }
  }

  useEffect(() => {
    loadSettlements()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reconciliation</h1>
          <p className="text-gray-500 mt-1">Track settlements, fees, and net deposits.</p>
        </div>
        <Button
          onClick={loadSettlements}
          variant="outline"
          className="border-white/10 text-gray-300 hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="rounded-2xl bg-[#111] border border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
          <Search className="h-4 w-4" />
          Filters
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white"
            >
              <option value="all">All</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">PSP</p>
            <select
              value={pspFilter}
              onChange={(e) => setPspFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white"
            >
              <option value="all">All</option>
              {pspOptions.map((psp) => (
                <option key={psp} value={psp}>{psp}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Deposit start</p>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#0a0a0a] border-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Deposit end</p>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#0a0a0a] border-white/10 text-white"
            />
          </div>
        </div>
        <Button
          onClick={loadSettlements}
          disabled={loading}
          className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
        >
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
                  <th className="text-left py-3 px-6 text-xs uppercase tracking-wider">Gross</th>
                  <th className="text-left py-3 px-6 text-xs uppercase tracking-wider">Fees</th>
                  <th className="text-left py-3 px-6 text-xs uppercase tracking-wider">Net</th>
                  <th className="text-left py-3 px-6 text-xs uppercase tracking-wider">Deposited</th>
                  <th className="text-left py-3 px-6 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-6 text-xs uppercase tracking-wider">View</th>
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-500">No settlements yet.</td>
                  </tr>
                ) : settlements.map((settlement) => (
                  <tr key={settlement.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-6 py-3 text-gray-300">{settlement.id.slice(0, 8)}...</td>
                    <td className="px-6 py-3 text-gray-300">{settlement.psp}</td>
                    <td className="px-6 py-3 text-gray-300">{formatAmount(settlement.gross_amount, settlement.currency)}</td>
                    <td className="px-6 py-3 text-gray-300">{formatAmount(settlement.fee_amount, settlement.currency)}</td>
                    <td className="px-6 py-3 text-gray-300">{formatAmount(settlement.net_amount, settlement.currency)}</td>
                    <td className="px-6 py-3 text-gray-400">{formatDate(settlement.deposited_at)}</td>
                    <td className="px-6 py-3">
                      <Badge className={statusStyles[settlement.status] || 'bg-white/5 text-gray-300'}>
                        {settlement.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#19d1c3] hover:text-[#c8ff5a]"
                        onClick={() => loadSettlementItems(settlement)}
                      >
                        View
                      </Button>
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
            <p className="text-sm text-gray-500">Inspect line items and reconcile deposits.</p>
          </div>

          {!selectedSettlement ? (
            <div className="text-sm text-gray-500">Select a settlement to view details.</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="text-xs text-gray-500">Settlement</div>
                <div className="text-sm text-white">{selectedSettlement.id}</div>
                <div className="text-xs text-gray-500">Period</div>
                <div className="text-sm text-white">{formatDate(selectedSettlement.period_start)} - {formatDate(selectedSettlement.period_end)}</div>
                <div className="text-xs text-gray-500">Net deposit</div>
                <div className="text-xl font-semibold text-white">
                  {formatAmount(selectedSettlement.net_amount, selectedSettlement.currency)}
                </div>
                <Badge className={statusStyles[selectedSettlement.status] || 'bg-white/5 text-gray-300'}>
                  {selectedSettlement.status}
                </Badge>
              </div>

              {selectedSettlement.status !== 'reconciled' && (
                <Button
                  onClick={markReconciled}
                  className="w-full bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as reconciled
                </Button>
              )}

              <div className="space-y-2">
                <div className="text-sm font-semibold text-white">Settlement items</div>
                {itemsLoading ? (
                  <div className="text-sm text-gray-500">Loading items...</div>
                ) : settlementItems.length === 0 ? (
                  <div className="text-sm text-gray-500">No items recorded for this settlement.</div>
                ) : (
                  <div className="space-y-3 max-h-[320px] overflow-auto pr-1">
                    {settlementItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-[#0a0a0a] p-3">
                        <div className="text-xs text-gray-500">Payment attempt</div>
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
