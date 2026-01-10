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
  Ban
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
  draft: { label: 'Draft', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: FileText },
  open: { label: 'Open', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Clock },
  paid: { label: 'Paid', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle },
  past_due: { label: 'Past Due', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertCircle },
  void: { label: 'Void', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: XCircle },
  uncollectible: { label: 'Uncollectible', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: Ban },
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customers (
          email,
          name
        ),
        invoice_line_items (
          id,
          description,
          amount,
          currency,
          quantity,
          price_id,
          prices (
            products (
              name
            )
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setInvoices(data as Invoice[])
    }

    setLoading(false)
  }

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.customers?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const finalizeInvoice = async (invoiceId: string) => {
    const supabase = createClient()
    await supabase
      .from('invoices')
      .update({
        status: 'open',
        finalized_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
    loadInvoices()
  }

  const payInvoice = async (invoiceId: string) => {
    const supabase = createClient()
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
    loadInvoices()
    setSelectedInvoice(null)
  }

  const voidInvoice = async (invoiceId: string) => {
    const supabase = createClient()
    await supabase
      .from('invoices')
      .update({
        status: 'void',
        voided_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
    loadInvoices()
    setSelectedInvoice(null)
  }

  const markUncollectible = async (invoiceId: string) => {
    const supabase = createClient()
    await supabase
      .from('invoices')
      .update({ status: 'uncollectible' })
      .eq('id', invoiceId)
    loadInvoices()
    setSelectedInvoice(null)
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status] || statusConfig.draft
    const Icon = config.icon
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  // Calculate totals for stats
  const paidTotal = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0)
  const openTotal = invoices
    .filter(i => ['open', 'past_due'].includes(i.status))
    .reduce((sum, i) => sum + i.total, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage billing invoices</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <span className="text-gray-500">Paid</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatAmount(paidTotal, 'usd')}</div>
          <div className="text-sm text-gray-500">{invoices.filter(i => i.status === 'paid').length} invoices</div>
        </div>

        <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-gray-500">Outstanding</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatAmount(openTotal, 'usd')}</div>
          <div className="text-sm text-gray-500">{invoices.filter(i => ['open', 'past_due'].includes(i.status)).length} invoices</div>
        </div>

        <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-gray-400" />
            </div>
            <span className="text-gray-500">Draft</span>
          </div>
          <div className="text-2xl font-bold text-white">{invoices.filter(i => i.status === 'draft').length}</div>
          <div className="text-sm text-gray-500">pending finalization</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search by customer, invoice number, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white min-w-[150px]"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="paid">Paid</option>
            <option value="past_due">Past Due</option>
            <option value="void">Void</option>
            <option value="uncollectible">Uncollectible</option>
          </select>
        </div>
      </div>

      {/* Invoices List */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">All Invoices</h2>
          <p className="text-sm text-gray-500">{filteredInvoices.length} invoices</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-500 border-r-transparent"></div>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-gray-500" />
              </div>
              <p className="text-gray-400 mb-2">No invoices found</p>
              <p className="text-sm text-gray-500">Invoices are created automatically for subscriptions</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedInvoice(invoice)}
                  >
                    <td className="py-4 px-6">
                      <div>
                        <code className="text-[#19d1c3]">{invoice.invoice_number || invoice.id.slice(0, 8)}</code>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(invoice.created_at)}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <span className="text-white">{invoice.customers?.name || 'Unnamed'}</span>
                        <p className="text-xs text-gray-500">{invoice.customers?.email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-white font-medium">
                        {formatAmount(invoice.total, invoice.currency)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-400 text-sm">
                        {invoice.due_date ? formatDate(invoice.due_date) : '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
                          {invoice.status === 'draft' && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                finalizeInvoice(invoice.id)
                              }}
                              className="text-gray-300 focus:bg-white/10 focus:text-white"
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Finalize
                            </DropdownMenuItem>
                          )}
                          {['open', 'past_due'].includes(invoice.status) && (
                            <>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  payInvoice(invoice.id)
                                }}
                                className="text-gray-300 focus:bg-white/10 focus:text-white"
                              >
                                <DollarSign className="h-4 w-4 mr-2" />
                                Mark Paid
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  markUncollectible(invoice.id)
                                }}
                                className="text-amber-400 focus:bg-amber-500/10 focus:text-amber-400"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Mark Uncollectible
                              </DropdownMenuItem>
                            </>
                          )}
                          {['draft', 'open'].includes(invoice.status) && (
                            <>
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  voidInvoice(invoice.id)
                                }}
                                className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Void
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail Sheet */}
      <Sheet open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <SheetContent className="bg-[#111] border-white/10 w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white">Invoice Details</SheetTitle>
          </SheetHeader>

          {selectedInvoice && (
            <div className="mt-6 space-y-6">
              {/* Header */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center justify-between mb-4">
                  <StatusBadge status={selectedInvoice.status} />
                  <span className="text-2xl font-bold text-white">
                    {formatAmount(selectedInvoice.total, selectedInvoice.currency)}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  Invoice {selectedInvoice.invoice_number || selectedInvoice.id.slice(0, 8)}
                </div>
              </div>

              {/* Customer */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Bill To</h3>
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-white font-medium">{selectedInvoice.customers?.name || 'Unnamed'}</div>
                  <div className="text-sm text-gray-500">{selectedInvoice.customers?.email}</div>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Line Items</h3>
                <div className="space-y-2">
                  {selectedInvoice.invoice_line_items?.length > 0 ? (
                    selectedInvoice.invoice_line_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <div>
                          <div className="text-white">
                            {item.prices?.products?.name || item.description || 'Line item'}
                          </div>
                          {item.quantity > 1 && (
                            <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                          )}
                        </div>
                        <span className="text-white font-medium">
                          {formatAmount(item.amount, item.currency)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-lg bg-white/5 text-gray-500 text-sm">
                      No line items
                    </div>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</h3>
                <div className="p-3 rounded-lg bg-white/5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-white">{formatAmount(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                  </div>
                  {selectedInvoice.tax > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Tax</span>
                      <span className="text-white">{formatAmount(selectedInvoice.tax, selectedInvoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
                    <span className="text-white font-medium">Total</span>
                    <span className="text-white font-medium">{formatAmount(selectedInvoice.total, selectedInvoice.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</h3>
                <div className="p-3 rounded-lg bg-white/5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Created</span>
                    <span className="text-white">{formatDate(selectedInvoice.created_at)}</span>
                  </div>
                  {selectedInvoice.due_date && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Due Date</span>
                      <span className="text-white">{formatDate(selectedInvoice.due_date)}</span>
                    </div>
                  )}
                  {selectedInvoice.paid_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Paid</span>
                      <span className="text-green-400">{formatDate(selectedInvoice.paid_at)}</span>
                    </div>
                  )}
                  {selectedInvoice.voided_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Voided</span>
                      <span className="text-gray-400">{formatDate(selectedInvoice.voided_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* IDs */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Identifiers</h3>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <div className="text-xs text-gray-500">Invoice ID</div>
                    <code className="text-sm text-[#19d1c3]">{selectedInvoice.id}</code>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(selectedInvoice.id, 'inv_id')}
                    className="h-8 w-8 text-gray-400 hover:text-white"
                  >
                    {copied === 'inv_id' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Actions */}
              {['draft', 'open', 'past_due'].includes(selectedInvoice.status) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</h3>
                  <div className="flex gap-2">
                    {selectedInvoice.status === 'draft' && (
                      <Button
                        className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90"
                        onClick={() => finalizeInvoice(selectedInvoice.id)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Finalize
                      </Button>
                    )}
                    {['open', 'past_due'].includes(selectedInvoice.status) && (
                      <Button
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90"
                        onClick={() => payInvoice(selectedInvoice.id)}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Mark Paid
                      </Button>
                    )}
                    {['draft', 'open'].includes(selectedInvoice.status) && (
                      <Button
                        variant="outline"
                        className="flex-1 border-red-500/20 text-red-400 hover:bg-red-500/10"
                        onClick={() => voidInvoice(selectedInvoice.id)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Void
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
