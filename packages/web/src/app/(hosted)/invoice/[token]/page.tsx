'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  CreditCard,
  Lock,
  CheckCircle,
  AlertCircle,
  Download,
  Calendar,
  Building2
} from 'lucide-react'

interface LineItem {
  id: string
  description: string
  quantity: number
  unit_amount: number
  amount: number
}

interface Invoice {
  id: string
  number: string | null
  status: string
  amount_due: number
  amount_paid: number
  amount_remaining: number
  currency: string
  created_at: string
  due_date: string | null
  paid_at: string | null
  customer_id: string
  subscription_id: string | null
  tenant_id: string
  invoice_line_items: LineItem[]
  customers: {
    id: string
    email: string
    name: string | null
  }
  tenants: {
    name: string
  }
}

export default function InvoicePage() {
  const params = useParams()
  const token = params.token as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadInvoice()
  }, [token])

  const loadInvoice = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Token is the invoice ID for now (could be a separate access token)
      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_line_items (*),
          customers (
            id,
            email,
            name
          ),
          tenants (
            name
          )
        `)
        .eq('id', token)
        .single()

      if (fetchError || !data) {
        setError('Invoice not found')
        setLoading(false)
        return
      }

      // Check if already paid
      if (data.status === 'paid') {
        setSuccess(true)
      }

      setInvoice(data)
    } catch (err) {
      setError('Failed to load invoice')
    }

    setLoading(false)
  }

  const formatAmount = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Draft' },
      open: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Open' },
      paid: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'Paid' },
      void: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Void' },
      uncollectible: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Uncollectible' },
    }

    const style = styles[status] || styles.draft

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    )
  }

  const handlePay = async () => {
    if (!invoice) return

    setProcessing(true)

    try {
      const supabase = createClient()

      // For demo purposes, mark as paid
      // In production, this would initiate payment via orchestrator
      await supabase
        .from('invoices')
        .update({
          status: 'paid',
          amount_paid: invoice.amount_due,
          amount_remaining: 0,
          paid_at: new Date().toISOString()
        })
        .eq('id', invoice.id)

      setSuccess(true)
    } catch (err) {
      setError('Payment failed. Please try again.')
    }

    setProcessing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto">
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Invoice Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Payment Successful!</h1>
          <p className="text-gray-400 mb-4">
            Thank you for your payment. A receipt has been sent to {invoice?.customers?.email}.
          </p>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Receipt
          </Button>
        </div>
      </div>
    )
  }

  const isPayable = invoice?.status === 'open' && (invoice?.amount_remaining || 0) > 0

  return (
    <div className="max-w-3xl mx-auto">
      {/* Invoice Header */}
      <div className="rounded-2xl bg-[#111] border border-white/10 p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">
                Invoice {invoice?.number || `#${invoice?.id.slice(0, 8)}`}
              </h1>
              {getStatusBadge(invoice?.status || 'draft')}
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Building2 className="h-4 w-4" />
              <span>{invoice?.tenants?.name || 'Merchant'}</span>
            </div>
          </div>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs text-gray-500 mb-1">Invoice Date</div>
            <div className="text-white font-medium">
              {invoice?.created_at ? formatDate(invoice.created_at) : '-'}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs text-gray-500 mb-1">Due Date</div>
            <div className="text-white font-medium">
              {invoice?.due_date ? formatDate(invoice.due_date) : 'Upon receipt'}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs text-gray-500 mb-1">Amount Due</div>
            <div className="text-white font-medium">
              {formatAmount(invoice?.amount_remaining || invoice?.amount_due || 0, invoice?.currency)}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-xs text-gray-500 mb-1">Bill To</div>
            <div className="text-white font-medium truncate">
              {invoice?.customers?.name || invoice?.customers?.email}
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Line Items</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Description</th>
              <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Qty</th>
              <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Unit Price</th>
              <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice?.invoice_line_items?.map((item) => (
              <tr key={item.id} className="border-b border-white/5 last:border-0">
                <td className="px-6 py-4 text-white">
                  {item.description || 'Line item'}
                </td>
                <td className="px-6 py-4 text-gray-400 text-right">
                  {item.quantity}
                </td>
                <td className="px-6 py-4 text-gray-400 text-right">
                  {formatAmount(item.unit_amount, invoice?.currency)}
                </td>
                <td className="px-6 py-4 text-white font-medium text-right">
                  {formatAmount(item.amount, invoice?.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10">
              <td colSpan={3} className="px-6 py-4 text-right text-gray-400">
                Subtotal
              </td>
              <td className="px-6 py-4 text-right text-white font-medium">
                {formatAmount(invoice?.amount_due || 0, invoice?.currency)}
              </td>
            </tr>
            {(invoice?.amount_paid || 0) > 0 && (
              <tr className="border-t border-white/10">
                <td colSpan={3} className="px-6 py-4 text-right text-gray-400">
                  Amount Paid
                </td>
                <td className="px-6 py-4 text-right text-green-400 font-medium">
                  -{formatAmount(invoice?.amount_paid || 0, invoice?.currency)}
                </td>
              </tr>
            )}
            <tr className="border-t border-white/10 bg-white/5">
              <td colSpan={3} className="px-6 py-4 text-right text-white font-semibold">
                Amount Due
              </td>
              <td className="px-6 py-4 text-right text-2xl font-bold text-white">
                {formatAmount(invoice?.amount_remaining || invoice?.amount_due || 0, invoice?.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment Section */}
      {isPayable && (
        <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Pay Invoice</h2>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-3 mb-4">
            <CreditCard className="h-5 w-5 text-gray-500" />
            <div className="flex-1">
              <div className="text-white text-sm">Card payment</div>
              <div className="text-xs text-gray-500">Demo mode - no real payment will be processed</div>
            </div>
          </div>

          {/* Card form placeholder */}
          <div className="rounded-xl bg-[#0a0a0a] border border-white/10 p-4 mb-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-gray-400 text-xs">Card number</label>
                <div className="h-10 rounded-md bg-white/5 border border-white/10 px-3 flex items-center">
                  <span className="text-gray-500 text-sm">4242 4242 4242 4242</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-gray-400 text-xs">Expiry</label>
                  <div className="h-10 rounded-md bg-white/5 border border-white/10 px-3 flex items-center">
                    <span className="text-gray-500 text-sm">12/28</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-gray-400 text-xs">CVC</label>
                  <div className="h-10 rounded-md bg-white/5 border border-white/10 px-3 flex items-center">
                    <span className="text-gray-500 text-sm">123</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handlePay}
            disabled={processing}
            className="w-full h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-lg"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Pay {formatAmount(invoice?.amount_remaining || invoice?.amount_due || 0, invoice?.currency)}</>
            )}
          </Button>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Lock className="h-4 w-4" />
            <span>Payments are secure and encrypted</span>
          </div>
        </div>
      )}

      {/* Void/Uncollectible Notice */}
      {(invoice?.status === 'void' || invoice?.status === 'uncollectible') && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-white mb-1">
            {invoice?.status === 'void' ? 'Invoice Voided' : 'Invoice Uncollectible'}
          </h2>
          <p className="text-gray-400">
            {invoice?.status === 'void'
              ? 'This invoice has been voided and cannot be paid.'
              : 'This invoice has been marked as uncollectible.'}
          </p>
        </div>
      )}
    </div>
  )
}
