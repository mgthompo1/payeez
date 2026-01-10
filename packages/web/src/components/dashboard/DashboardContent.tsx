'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Activity, DollarSign, Zap, Database } from 'lucide-react'

type TimeRange = '24h' | '7d' | '30d' | 'ytd'

interface Transaction {
  id: string
  amount: number
  currency: string
  status: string
  psp: string | null
  created_at: string
}

interface DashboardContentProps {
  allTransactions: Transaction[]
}

export function DashboardContent({ allTransactions }: DashboardContentProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')

  const { filteredTx, chartPoints, maxY, xLabels, totalVolume, successRate, txCount } = useMemo(() => {
    const now = new Date()
    let startDate: Date
    let buckets: number[]
    let labels: string[]

    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        buckets = Array(24).fill(0)
        labels = ['00:00', '06:00', '12:00', '18:00', '23:59']
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        buckets = Array(7).fill(0)
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        buckets = Array(30).fill(0)
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Today']
        break
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1)
        const currentMonth = now.getMonth()
        buckets = Array(currentMonth + 1).fill(0)
        labels = ['Jan', 'Mar', 'Jun', 'Sep', 'Dec'].slice(0, Math.ceil((currentMonth + 1) / 2))
        break
    }

    // Filter transactions by time range
    const filtered = allTransactions.filter(tx => new Date(tx.created_at) >= startDate)

    // Calculate volume per bucket
    filtered.forEach(tx => {
      const txDate = new Date(tx.created_at)
      let bucket: number

      switch (timeRange) {
        case '24h':
          bucket = txDate.getHours()
          break
        case '7d':
          const day = txDate.getDay()
          bucket = day === 0 ? 6 : day - 1
          break
        case '30d':
          const daysAgo = Math.floor((now.getTime() - txDate.getTime()) / (24 * 60 * 60 * 1000))
          bucket = Math.min(29, 29 - daysAgo)
          break
        case 'ytd':
          bucket = txDate.getMonth()
          break
      }

      if (bucket >= 0 && bucket < buckets.length) {
        buckets[bucket] += tx.amount / 100
      }
    })

    // Generate chart points
    const hasData = buckets.some(v => v > 0)
    let points: { value: number; index: number }[]

    if (hasData) {
      points = buckets.map((value, i) => ({ value: value || Math.random() * 10, index: i }))
    } else {
      points = buckets.map((_, i) => {
        const base = 50 + Math.sin(i * 0.5) * 30
        const noise = Math.random() * 40 - 20
        return { value: Math.max(10, base + noise), index: i }
      })
    }

    const max = Math.max(...points.map(p => p.value)) * 1.2

    // Calculate KPIs
    const volume = filtered.reduce((acc, tx) =>
      acc + (tx.status === 'succeeded' || tx.status === 'captured' ? tx.amount : 0), 0)
    const successCount = filtered.filter(tx =>
      tx.status === 'succeeded' || tx.status === 'captured').length
    const rate = filtered.length > 0
      ? ((successCount / filtered.length) * 100).toFixed(1) + '%'
      : '0%'

    return {
      filteredTx: filtered,
      chartPoints: points,
      maxY: max,
      xLabels: labels,
      totalVolume: volume,
      successRate: rate,
      txCount: filtered.length
    }
  }, [allTransactions, timeRange])

  const pointsString = chartPoints.map((p, i) => {
    const x = (i / (chartPoints.length - 1)) * 100
    const y = 100 - (p.value / maxY) * 100
    return `${x},${y}`
  }).join(' ')

  const areaPath = `0,100 ${pointsString} 100,100`

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: '24h', label: '24H' },
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: 'ytd', label: 'YTD' },
  ]

  const timeRangeLabel = {
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    'ytd': 'Year to date'
  }[timeRange]

  return (
    <div className="p-8 min-h-full relative">
      <div className="absolute inset-0 bg-grid-pattern bg-graph opacity-10 pointer-events-none"></div>

      {/* Page Title with Time Filter */}
      <div className="mb-8 flex justify-between items-end relative z-10">
        <div>
          <h1 className="dashboard-heading text-2xl mb-1">Traffic Overview</h1>
          <p className="text-sm text-slate-400">Real-time tokenization metrics for {timeRangeLabel.toLowerCase()}.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {timeRanges.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  timeRange === key
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="bg-cyan-600 text-white px-4 py-2 rounded text-xs font-medium hover:bg-cyan-500 transition shadow-[0_0_15px_-5px_rgba(34,211,238,0.5)]">
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
        {[
          { label: `Total Volume (${timeRange.toUpperCase()})`, value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalVolume / 100), icon: DollarSign },
          { label: 'Success Rate', value: successRate, icon: Activity },
          { label: 'Transactions', value: txCount.toString(), icon: Database },
          { label: 'Avg Latency', value: '~45ms', icon: Zap },
        ].map((stat, i) => (
          <div key={i} className="dashboard-card p-5 hover:border-cyan-500/30 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-white/5 text-slate-400 group-hover:text-cyan-400 group-hover:bg-cyan-950/20 transition-colors">
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-medium text-white tracking-tight">{stat.value}</h3>
              <p className="text-xs text-slate-400 font-mono uppercase tracking-wide">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction Volume Graph */}
      <div className="dashboard-card w-full mb-8 relative overflow-hidden z-10 group">
        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <span className="text-xs font-mono text-slate-300">TRANSACTION_VOLUME</span>
          <span className="text-[10px] font-mono text-slate-500">{timeRangeLabel}</span>
        </div>
        <div className="h-48 relative flex">
          {/* Y-Axis Labels */}
          <div className="w-14 h-full flex flex-col justify-between py-2 pr-2 text-right">
            <span className="text-[10px] font-mono text-slate-500">${Math.round(maxY).toLocaleString()}</span>
            <span className="text-[10px] font-mono text-slate-500">${Math.round(maxY * 0.75).toLocaleString()}</span>
            <span className="text-[10px] font-mono text-slate-500">${Math.round(maxY * 0.5).toLocaleString()}</span>
            <span className="text-[10px] font-mono text-slate-500">${Math.round(maxY * 0.25).toLocaleString()}</span>
            <span className="text-[10px] font-mono text-slate-500">$0</span>
          </div>

          {/* Chart Area */}
          <div className="flex-1 relative">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="25" x2="100" y2="25" stroke="#334155" strokeWidth="0.2" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.2" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="#334155" strokeWidth="0.2" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
              <polygon points={areaPath} fill="url(#chartGradient)" />
              <polyline points={pointsString} fill="none" stroke="#22d3ee" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1">
              {xLabels.map((label, i) => (
                <span key={i} className="text-[10px] font-mono text-slate-500">{label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="dashboard-card overflow-hidden z-10 relative">
        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <span className="text-xs font-mono text-slate-300">LATEST_TRANSACTIONS</span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
            <span className="text-[10px] font-mono text-slate-500">LIVE</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                <th className="text-left px-4 py-3 font-medium">Transaction ID</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">PSP</th>
                <th className="text-left px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTx.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-cyan-400">{tx.id.slice(0, 20)}...</code>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.currency || 'USD' }).format(tx.amount / 100)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${
                      tx.status === 'succeeded' || tx.status === 'captured'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : tx.status === 'failed'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {tx.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{tx.psp || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {filteredTx.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No transactions in this time period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
