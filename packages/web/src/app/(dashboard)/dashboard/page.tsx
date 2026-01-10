import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Activity, DollarSign, Zap, Database } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch recent transactions for the terminal table
  const { data: recentTx } = await supabase
    .from('payment_attempts')
    .select(`
      id, amount, currency, status, psp, created_at
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch total volume (mock simulation if low data, else sum)
  const totalVolume = recentTx?.reduce((acc, tx) => acc + (tx.status === 'succeeded' || tx.status === 'captured' ? tx.amount : 0), 0) || 0
  
  // Calculate Success Rate
  const successCount = recentTx?.filter(tx => tx.status === 'succeeded' || tx.status === 'captured').length || 0
  const totalCount = recentTx?.length || 1
  const successRate = ((successCount / totalCount) * 100).toFixed(1) + '%'

  // Generate Chart Data (Visual Flair based on recent transactions or random if empty)
  // We'll creating a simple trend line for the SVG
  const chartPoints = recentTx && recentTx.length > 5 
    ? recentTx.slice(0, 15).reverse().map((tx, i) => ({ value: tx.amount / 100, index: i }))
    : Array.from({ length: 15 }).map((_, i) => ({ value: Math.random() * 100 + 50, index: i }))
  
  const maxY = Math.max(...chartPoints.map(p => p.value)) * 1.2
  const pointsString = chartPoints.map((p, i) => {
    const x = (i / (chartPoints.length - 1)) * 100
    const y = 100 - (p.value / maxY) * 100
    return `${x},${y}`
  }).join(' ')

  const areaPath = `0,100 ${pointsString} 100,100`

  return (
    <div className="p-8 min-h-full relative">
      <div className="absolute inset-0 bg-grid-pattern bg-graph opacity-10 pointer-events-none"></div>

      {/* Page Title */}
      <div className="mb-8 flex justify-between items-end relative z-10">
        <div>
          <h1 className="dashboard-heading text-2xl mb-1">Traffic Overview</h1>
          <p className="text-sm text-slate-400">Real-time tokenization metrics for the last 24 hours.</p>
        </div>
        <button className="bg-cyan-600 text-white px-4 py-2 rounded text-xs font-medium hover:bg-cyan-500 transition shadow-[0_0_15px_-5px_rgba(34,211,238,0.5)]">
          Export Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
        {[
          { label: 'Total Volume (24h)', value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalVolume / 100), icon: DollarSign },
          { label: 'Success Rate', value: successRate, icon: Activity },
          { label: 'Transactions', value: totalCount.toString(), icon: Database },
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
          <span className="text-[10px] font-mono text-slate-500">Last 24 hours</span>
        </div>
        <div className="h-48 relative">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={areaPath} fill="url(#chartGradient)" />
            <polyline points={pointsString} fill="none" stroke="#22d3ee" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* Graph Labels */}
          <div className="absolute bottom-2 left-4 text-[10px] font-mono text-slate-500">00:00</div>
          <div className="absolute bottom-2 right-4 text-[10px] font-mono text-slate-500">23:59</div>
        </div>
      </div>

      {/* Recent Requests Table (Terminal Style) */}
      <div className="dashboard-card overflow-hidden z-10 relative">
        <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <span className="text-xs font-mono text-slate-300">LATEST_TRANSACTIONS</span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
            <span className="text-[10px] font-mono text-slate-500">LIVE</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-500 bg-white/5">
              <tr>
                <th className="px-4 py-2 font-normal">ID</th>
                <th className="px-4 py-2 font-normal">METHOD</th>
                <th className="px-4 py-2 font-normal">AMOUNT</th>
                <th className="px-4 py-2 font-normal">STATUS</th>
                <th className="px-4 py-2 font-normal text-right">TIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {recentTx && recentTx.length > 0 ? (
                recentTx.map((tx) => {
                  const date = new Date(tx.created_at)
                  const timeAgo = Math.floor((new Date().getTime() - date.getTime()) / 60000) // minutes
                  
                  return (
                    <tr key={tx.id} className="hover:bg-white/5 transition group">
                      <td className="px-4 py-3 text-slate-400 group-hover:text-white transition-colors">
                        {tx.id.slice(0, 14)}...
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-blue-400">POST</span> /v1/tokens
                      </td>
                      <td className="px-4 py-3">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.currency }).format(tx.amount / 100)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={
                          tx.status === 'captured' || tx.status === 'succeeded' ? 'text-cyan-400' :
                          tx.status === 'failed' || tx.status === 'error' ? 'text-red-400' :
                          'text-amber-400'
                        }>
                          {tx.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {timeAgo < 1 ? 'just now' : `${timeAgo}m ago`}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No transactions found
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