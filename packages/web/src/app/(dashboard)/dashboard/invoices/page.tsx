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
  FileText,
  Search,
  MoreHorizontal,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  Download,
  ExternalLink,
  Copy,
  Check,
  Ban,
  Loader2
} from 'lucide-react'

interface InvoiceLineItem {
  id: string
  description: string
  amount: number
  currency: string
  quantity: number
  price_id: string | null
  prices: {
    products: {
      name: string
    }
  } | null
}

interface Invoice {
  id: string
  invoice_number: string | null
  customer_id: string
  subscription_id: string | null
  status: string
  collection_method: string
  currency: string
  subtotal: number
  tax: number
  total: number
  due_date: string | null
  period_start: string | null
  period_end: string | null
  paid_at: string | null
  voided_at: string | null
  created_at: string
  customers: {
    email: string
    name: string | null
  }
  invoice_line_items: InvoiceLineItem[]
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: FileText },
  open: { label: 'Open', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Clock },
  paid: { label: 'Paid', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
  past_due: { label: 'Past Due', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertCircle },
  void: { label: 'Void', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: XCircle },
  uncollectible: { label: 'Uncollectible', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: Ban },
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { loadInvoices() }, [])

  const loadInvoices = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('invoices').select('*, customers(email, name), invoice_line_items(*, prices(products(name)))').order('created_at', { ascending: false })
    if (!error && data) setInvoices(data as Invoice[])
    setLoading(false)
  }

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.customers?.email?.toLowerCase().includes(searchQuery.toLowerCase()) || inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const copyToClipboard = (text: string, field: string) => { navigator.clipboard.writeText(text); setCopied(field); setTimeout(() => setCopied(null), 2000) }
  const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100)
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status] || statusConfig.draft
    const Icon = config.icon
    return <Badge className={`${config.color} gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-tighter`}><Icon className="h-3 w-3" />{config.label}</Badge>
  }

  const paidTotal = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)
  const openTotal = invoices.filter(i => ['open', 'past_due'].includes(i.status)).reduce((sum, i) => sum + i.total, 0)

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Invoices</h1>
          <p className="text-slate-500 mt-1">Audit and manage institutional disbursements.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Paid Revenue', value: formatAmount(paidTotal, 'usd'), count: `${invoices.filter(i => i.status === 'paid').length} settled`, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Outstanding', value: formatAmount(openTotal, 'usd'), count: `${invoices.filter(i => ['open', 'past_due'].includes(i.status)).length} pending`, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Draft Queue', value: invoices.filter(i => i.status === 'draft').length, count: 'awaiting action', icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        ].map((stat, i) => (
          <div key={i} className="dashboard-card p-6 flex items-center gap-5">
            <div className={`h-12 w-12 rounded-xl ${stat.bg} border border-white/5 flex items-center justify-center`}><stat.icon className={`h-6 w-6 ${stat.color}`} /></div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>
              <p className="text-[10px] text-slate-600 font-medium uppercase mt-0.5">{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-card p-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input placeholder="Search by customer or reference..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-obsidian border-white/10 text-white focus:border-cyan-400" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none min-w-[160px]">
          <option value="all">All Statuses</option><option value="draft">Draft</option><option value="open">Open</option><option value="paid">Paid</option>
        </select>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
          <h2 className="text-lg font-semibold text-white">Invoice Registry</h2>
          <Badge variant="outline" className="bg-white/5 text-slate-400 border-white/10 font-mono text-[10px]">{filteredInvoices.length} ENTRIES</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                <th className="text-left py-4 px-6">Reference</th>
                <th className="text-left py-4 px-6">Customer</th>
                <th className="text-left py-4 px-6">Status</th>
                <th className="text-left py-4 px-6">Total Yield</th>
                <th className="text-right py-4 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="h-8 w-8 text-cyan-400 animate-spin mx-auto" /></td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-600 italic">No ledger data found.</td></tr>
              ) : filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer group" onClick={() => setSelectedInvoice(inv)}>
                  <td className="py-4 px-6">
                    <code className="text-cyan-400 bg-cyan-400/5 px-2 py-1 rounded font-mono text-xs">{inv.invoice_number || inv.id.slice(0, 8)}</code>
                    <p className="text-[10px] text-slate-600 font-bold uppercase mt-1">{formatDate(inv.created_at)}</p>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-white font-medium group-hover:text-cyan-400 transition-colors">{inv.customers?.name || 'Unnamed'}</span>
                    <p className="text-xs text-slate-500">{inv.customers?.email}</p>
                  </td>
                  <td className="py-4 px-6"><StatusBadge status={inv.status} /></td>
                  <td className="py-4 px-6 text-white font-bold">{formatAmount(inv.total, inv.currency)}</td>
                  <td className="py-4 px-6 text-right"><Button variant="ghost" size="icon" className="text-slate-500 group-hover:text-white rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <SheetContent className="bg-charcoal border-white/10 w-[500px] overflow-y-auto text-slate-300">
          <SheetHeader><SheetTitle className="text-white">Invoice Detail</SheetTitle></SheetHeader>
          {selectedInvoice && (
            <div className="mt-8 space-y-6">
              <div className="dashboard-card bg-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={selectedInvoice.status} />
                  <span className="text-3xl font-bold text-white tracking-tighter">{formatAmount(selectedInvoice.total, selectedInvoice.currency)}</span>
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pt-2 border-t border-white/5">Ref: {selectedInvoice.id}</div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Line Items</h3>
                <div className="grid gap-2">
                  {selectedInvoice.invoice_line_items?.map((item) => (
                    <div key={item.id} className="dashboard-card bg-black/20 p-4 flex justify-between items-center border-white/5">
                      <div><p className="text-sm text-slate-200 font-medium">{item.prices?.products?.name || item.description}</p><p className="text-[10px] text-slate-500 uppercase font-bold">Qty: {item.quantity}</p></div>
                      <span className="text-white font-bold font-mono">{formatAmount(item.amount, item.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-white/10">
                <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-full h-11 shadow-lg shadow-cyan-500/20">Acknowledge Payment</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}