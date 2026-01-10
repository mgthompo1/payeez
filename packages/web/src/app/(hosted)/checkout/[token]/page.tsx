'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CreditCard, Lock, CheckCircle, AlertCircle } from 'lucide-react'

interface LineItem {
  price_id: string
  quantity: number
  amount_total: number
  currency?: string
  product_name?: string
}

interface CheckoutSession {
  id: string
  mode: string
  status: string
  customer_id: string | null
  customer_email: string | null
  line_items: LineItem[]
  success_url: string
  cancel_url: string
  expires_at: string
  subscription_data?: {
    trial_period_days?: number
  }
}

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [session, setSession] = useState<CheckoutSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)

  // Form state
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    loadSession()
  }, [token])

  const loadSession = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data, error: fetchError } = await supabase
        .from('checkout_sessions')
        .select(`
          *,
          customers (
            email,
            name
          )
        `)
        .eq('access_token', token)
        .single()

      if (fetchError || !data) {
        setError('Checkout session not found')
        setLoading(false)
        return
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError('This checkout session has expired')
        setLoading(false)
        return
      }

      // Check if already completed
      if (data.status === 'complete') {
        setSuccess(true)
        setLoading(false)
        return
      }

      // Fetch product names for line items
      const priceIds = data.line_items.map((item: LineItem) => item.price_id)
      const { data: prices } = await supabase
        .from('prices')
        .select('id, currency, products(name)')
        .in('id', priceIds)

      const priceMap = new Map()
      prices?.forEach((p: any) => {
        priceMap.set(p.id, {
          currency: p.currency,
          product_name: p.products?.name
        })
      })

      const enrichedLineItems = data.line_items.map((item: LineItem) => ({
        ...item,
        ...priceMap.get(item.price_id)
      }))

      setSession({
        ...data,
        line_items: enrichedLineItems
      })

      if (data.customers?.email) {
        setEmail(data.customers.email)
      }
      if (data.customer_email) {
        setEmail(data.customer_email)
      }
      if (data.customers?.name) {
        setName(data.customers.name)
      }
    } catch (err) {
      setError('Failed to load checkout session')
    }

    setLoading(false)
  }

  const formatAmount = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const calculateTotal = () => {
    return session?.line_items.reduce((sum, item) => sum + item.amount_total, 0) || 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return

    setProcessing(true)

    try {
      const supabase = createClient()

      // Create or get customer
      let customerId = session.customer_id

      if (!customerId && email) {
        // Check if customer exists
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', email)
          .single()

        if (existingCustomer) {
          customerId = existingCustomer.id
        } else {
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              email,
              name: name || null,
              tenant_id: (await supabase.from('checkout_sessions').select('tenant_id').eq('id', session.id).single()).data?.tenant_id
            })
            .select()
            .single()

          if (!customerError && newCustomer) {
            customerId = newCustomer.id
          }
        }
      }

      // For demo purposes, mark as complete
      // In a real implementation, this would initiate payment via Elements iframe
      await supabase
        .from('checkout_sessions')
        .update({
          status: 'complete',
          customer_id: customerId,
          customer_details: { email, name }
        })
        .eq('id', session.id)

      // Create subscription if subscription mode
      if (session.mode === 'subscription' && customerId) {
        const firstLineItem = session.line_items[0]

        // Get price details
        const { data: priceData } = await supabase
          .from('prices')
          .select('recurring_interval, recurring_interval_count')
          .eq('id', firstLineItem.price_id)
          .single()

        const now = new Date()
        let trialEnd = null
        let status = 'active'

        if (session.subscription_data?.trial_period_days) {
          trialEnd = new Date(now)
          trialEnd.setDate(trialEnd.getDate() + session.subscription_data.trial_period_days)
          status = 'trialing'
        }

        const periodEnd = new Date(now)
        switch (priceData?.recurring_interval) {
          case 'day':
            periodEnd.setDate(periodEnd.getDate() + (priceData?.recurring_interval_count || 1))
            break
          case 'week':
            periodEnd.setDate(periodEnd.getDate() + 7 * (priceData?.recurring_interval_count || 1))
            break
          case 'month':
            periodEnd.setMonth(periodEnd.getMonth() + (priceData?.recurring_interval_count || 1))
            break
          case 'year':
            periodEnd.setFullYear(periodEnd.getFullYear() + (priceData?.recurring_interval_count || 1))
            break
        }

        const { data: subscription } = await supabase
          .from('subscriptions')
          .insert({
            tenant_id: (await supabase.from('checkout_sessions').select('tenant_id').eq('id', session.id).single()).data?.tenant_id,
            customer_id: customerId,
            status,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            trial_start: trialEnd ? now.toISOString() : null,
            trial_end: trialEnd?.toISOString() || null,
          })
          .select()
          .single()

        if (subscription) {
          // Create subscription items
          for (const item of session.line_items) {
            await supabase.from('subscription_items').insert({
              subscription_id: subscription.id,
              price_id: item.price_id,
              quantity: item.quantity
            })
          }

          // Update checkout session with subscription
          await supabase
            .from('checkout_sessions')
            .update({ subscription_id: subscription.id })
            .eq('id', session.id)
        }
      }

      setSuccess(true)

      // Redirect to success URL after delay
      setTimeout(() => {
        window.location.href = session.success_url
      }, 2000)
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
          <h1 className="text-xl font-bold text-white mb-2">Checkout Error</h1>
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
          <p className="text-gray-400">Redirecting you back...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Order Summary */}
      <div className="order-2 md:order-1">
        <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Order Summary</h2>

          <div className="space-y-4">
            {session?.line_items.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-white/10">
                <div>
                  <div className="text-white font-medium">{item.product_name || 'Product'}</div>
                  <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                </div>
                <div className="text-white font-medium">
                  {formatAmount(item.amount_total, item.currency)}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-4">
              <span className="text-lg font-semibold text-white">Total</span>
              <span className="text-2xl font-bold text-white">
                {formatAmount(calculateTotal(), session?.line_items[0]?.currency)}
              </span>
            </div>

            {session?.mode === 'subscription' && (
              <div className="text-sm text-gray-500">
                {session.subscription_data?.trial_period_days
                  ? `${session.subscription_data.trial_period_days}-day free trial, then billed recurring`
                  : 'Billed recurring'}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Lock className="h-4 w-4" />
          <span>Payments are secure and encrypted</span>
        </div>
      </div>

      {/* Payment Form */}
      <div className="order-1 md:order-2">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Contact Information</h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Payment Method</h2>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-gray-500" />
              <div className="flex-1">
                <div className="text-white text-sm">Card payment</div>
                <div className="text-xs text-gray-500">Demo mode - no real payment will be processed</div>
              </div>
            </div>

            {/* Card form placeholder - in production, this would be an Elements iframe */}
            <div className="mt-4 rounded-xl bg-[#0a0a0a] border border-white/10 p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-xs">Card number</Label>
                  <div className="h-10 rounded-md bg-white/5 border border-white/10 px-3 flex items-center">
                    <span className="text-gray-500 text-sm">4242 4242 4242 4242</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-xs">Expiry</Label>
                    <div className="h-10 rounded-md bg-white/5 border border-white/10 px-3 flex items-center">
                      <span className="text-gray-500 text-sm">12/28</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-xs">CVC</Label>
                    <div className="h-10 rounded-md bg-white/5 border border-white/10 px-3 flex items-center">
                      <span className="text-gray-500 text-sm">123</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={processing || !email}
            className="w-full h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-lg"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Pay {formatAmount(calculateTotal(), session?.line_items[0]?.currency)}</>
            )}
          </Button>

          <p className="text-center text-sm text-gray-500">
            By confirming your payment, you agree to our terms of service.
          </p>
        </form>
      </div>
    </div>
  )
}
