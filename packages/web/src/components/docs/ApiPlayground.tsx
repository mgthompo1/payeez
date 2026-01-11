'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Loader2, Copy, Check, X, Terminal, Eye, EyeOff, ChevronRight } from 'lucide-react'

interface ApiPlaygroundProps {
  isOpen: boolean
  onClose: () => void
  initialEndpoint?: string
  initialMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  initialBody?: Record<string, any>
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.atlas.co/functions/v1'

const ENDPOINTS = [
  // Sessions & Payments
  { method: 'POST', path: '/create-session', label: 'Create Session', category: 'Sessions' },
  { method: 'GET', path: '/get-session/:id', label: 'Get Session', category: 'Sessions' },
  { method: 'POST', path: '/get-session-config', label: 'Get Session Config', category: 'Sessions' },
  { method: 'POST', path: '/confirm-payment', label: 'Confirm Payment', category: 'Payments' },
  { method: 'POST', path: '/capture-payment/:id', label: 'Capture Payment', category: 'Payments' },
  { method: 'POST', path: '/refund-payment/:id', label: 'Refund Payment', category: 'Payments' },
  { method: 'GET', path: '/payments', label: 'List Payments', category: 'Payments' },
  { method: 'GET', path: '/payments/:id', label: 'Get Payment', category: 'Payments' },

  // Customers
  { method: 'POST', path: '/customers', label: 'Create Customer', category: 'Customers' },
  { method: 'GET', path: '/customers', label: 'List Customers', category: 'Customers' },
  { method: 'GET', path: '/customers/:id', label: 'Get Customer', category: 'Customers' },
  { method: 'PATCH', path: '/customers/:id', label: 'Update Customer', category: 'Customers' },
  { method: 'DELETE', path: '/customers/:id', label: 'Delete Customer', category: 'Customers' },

  // Products
  { method: 'POST', path: '/products', label: 'Create Product', category: 'Products' },
  { method: 'GET', path: '/products', label: 'List Products', category: 'Products' },
  { method: 'GET', path: '/products/:id', label: 'Get Product', category: 'Products' },
  { method: 'PATCH', path: '/products/:id', label: 'Update Product', category: 'Products' },
  { method: 'DELETE', path: '/products/:id', label: 'Delete Product', category: 'Products' },

  // Prices
  { method: 'POST', path: '/prices', label: 'Create Price', category: 'Prices' },
  { method: 'GET', path: '/prices', label: 'List Prices', category: 'Prices' },
  { method: 'GET', path: '/prices/:id', label: 'Get Price', category: 'Prices' },
  { method: 'PATCH', path: '/prices/:id', label: 'Update Price', category: 'Prices' },

  // Subscriptions
  { method: 'POST', path: '/subscriptions', label: 'Create Subscription', category: 'Subscriptions' },
  { method: 'GET', path: '/subscriptions', label: 'List Subscriptions', category: 'Subscriptions' },
  { method: 'GET', path: '/subscriptions/:id', label: 'Get Subscription', category: 'Subscriptions' },
  { method: 'PATCH', path: '/subscriptions/:id', label: 'Update Subscription', category: 'Subscriptions' },
  { method: 'DELETE', path: '/subscriptions/:id', label: 'Cancel Subscription', category: 'Subscriptions' },

  // Invoices
  { method: 'POST', path: '/invoices', label: 'Create Invoice', category: 'Invoices' },
  { method: 'GET', path: '/invoices', label: 'List Invoices', category: 'Invoices' },
  { method: 'GET', path: '/invoices/:id', label: 'Get Invoice', category: 'Invoices' },
  { method: 'POST', path: '/invoices/:id/finalize', label: 'Finalize Invoice', category: 'Invoices' },
  { method: 'POST', path: '/invoices/:id/pay', label: 'Pay Invoice', category: 'Invoices' },
  { method: 'POST', path: '/invoices/:id/void', label: 'Void Invoice', category: 'Invoices' },

  // Bank Accounts / ACH
  { method: 'POST', path: '/bank-accounts', label: 'Create Bank Account', category: 'Bank Accounts' },
  { method: 'GET', path: '/bank-accounts', label: 'List Bank Accounts', category: 'Bank Accounts' },
  { method: 'GET', path: '/bank-accounts/:id', label: 'Get Bank Account', category: 'Bank Accounts' },
  { method: 'POST', path: '/bank-accounts/:id/verify', label: 'Verify Bank Account', category: 'Bank Accounts' },
  { method: 'DELETE', path: '/bank-accounts/:id', label: 'Delete Bank Account', category: 'Bank Accounts' },

  // Webhooks
  { method: 'POST', path: '/webhook-endpoints', label: 'Create Webhook', category: 'Webhooks' },
  { method: 'GET', path: '/webhook-endpoints', label: 'List Webhooks', category: 'Webhooks' },
  { method: 'GET', path: '/webhook-endpoints/:id', label: 'Get Webhook', category: 'Webhooks' },
  { method: 'PATCH', path: '/webhook-endpoints/:id', label: 'Update Webhook', category: 'Webhooks' },
  { method: 'DELETE', path: '/webhook-endpoints/:id', label: 'Delete Webhook', category: 'Webhooks' },
]

const DEFAULT_BODIES: Record<string, object> = {
  // Sessions
  '/create-session': {
    amount: 4990,
    currency: 'USD',
    customer: { email: 'test@example.com', name: 'Test User' },
    metadata: { order_id: 'order_123' }
  },
  '/get-session-config': {},

  // Payments
  '/confirm-payment': {
    session_id: 'sess_xxx',
    token_id: 'tok_xxx'
  },
  '/capture-payment/:id': {
    amount: 4990 // Optional: partial capture
  },
  '/refund-payment/:id': {
    amount: 2000, // Optional: partial refund
    reason: 'customer_request'
  },

  // Customers
  '/customers': {
    email: 'customer@example.com',
    name: 'John Doe',
    metadata: { source: 'api_playground' }
  },
  '/customers/:id': {
    name: 'John Doe Updated',
    email: 'updated@example.com',
    metadata: { notes: 'Updated via API' }
  },

  // Products
  '/products': {
    name: 'Test Product',
    description: 'A test product',
    metadata: { tier: 'basic' }
  },
  '/products/:id': {
    name: 'Updated Product Name',
    description: 'Updated description'
  },

  // Prices
  '/prices': {
    product: 'prod_xxx',
    currency: 'usd',
    unit_amount: 2999,
    type: 'recurring',
    recurring: { interval: 'month' }
  },
  '/prices/:id': {
    active: false,
    nickname: 'Updated Price'
  },

  // Subscriptions
  '/subscriptions': {
    customer: 'cus_xxx',
    items: [{ price: 'price_xxx', quantity: 1 }],
    trial_period_days: 14
  },
  '/subscriptions/:id': {
    items: [{ price: 'price_xxx', quantity: 2 }],
    proration_behavior: 'create_prorations'
  },

  // Invoices
  '/invoices': {
    customer: 'cus_xxx',
    collection_method: 'send_invoice',
    days_until_due: 30
  },
  '/invoices/:id/finalize': {},
  '/invoices/:id/pay': {
    payment_method: 'pm_xxx' // Optional
  },
  '/invoices/:id/void': {},

  // Bank Accounts
  '/bank-accounts': {
    customer: 'cus_xxx',
    account_holder_name: 'John Doe',
    account_holder_type: 'individual',
    routing_number: '110000000',
    account_number: '000123456789'
  },
  '/bank-accounts/:id/verify': {
    amounts: [32, 45] // Micro-deposit amounts
  },

  // Webhooks
  '/webhook-endpoints': {
    url: 'https://yoursite.com/webhooks/atlas',
    enabled_events: ['payment.captured', 'payment.failed', 'subscription.created', 'invoice.paid'],
    description: 'Production webhook'
  },
  '/webhook-endpoints/:id': {
    enabled_events: ['payment.captured', 'payment.failed'],
    disabled: false
  }
}

export function ApiPlayground({ isOpen, onClose, initialEndpoint, initialMethod, initialBody }: ApiPlaygroundProps) {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  // Store combined method:path for unique selection
  const [selectedValue, setSelectedValue] = useState(() => {
    const m = initialMethod || 'POST'
    const p = initialEndpoint || '/create-session'
    return `${m}:${p}`
  })

  // Derived values from selectedValue
  const [method, selectedEndpoint] = selectedValue.split(':') as [string, string]
  const [body, setBody] = useState('')
  const [pathParams, setPathParams] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{ status: number; data: any; duration: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Update body when endpoint changes
  useEffect(() => {
    if (initialBody) {
      setBody(JSON.stringify(initialBody, null, 2))
    } else {
      const defaultBody = DEFAULT_BODIES[selectedEndpoint]
      setBody(defaultBody ? JSON.stringify(defaultBody, null, 2) : '{}')
    }
  }, [selectedValue, initialBody, selectedEndpoint])

  // Check if endpoint has path parameters
  const hasPathParams = selectedEndpoint.includes(':')
  const pathParamNames = selectedEndpoint.match(/:(\w+)/g)?.map(p => p.slice(1)) || []

  const methodColors: Record<string, string> = {
    GET: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    POST: 'bg-green-500/10 text-green-400 border-green-500/20',
    PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
    PATCH: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }

  const executeRequest = async () => {
    if (!apiKey) {
      setError('Please enter your API key')
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)
    const startTime = Date.now()

    try {
      let parsedBody: any = null
      if (method !== 'GET' && body.trim()) {
        try {
          parsedBody = JSON.parse(body)
        } catch {
          setError('Invalid JSON in request body')
          setLoading(false)
          return
        }
      }

      // Build URL with path parameters
      let url = selectedEndpoint
      pathParamNames.forEach(param => {
        const value = pathParams[param]
        if (value) {
          url = url.replace(`:${param}`, value)
        }
      })

      const res = await fetch(`${API_BASE}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        ...(parsedBody && { body: JSON.stringify(parsedBody) }),
      })

      const duration = Date.now() - startTime
      let data: any

      try {
        data = await res.json()
      } catch {
        data = { message: 'No JSON response' }
      }

      setResponse({ status: res.status, data, duration })
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('Failed to fetch - check that the API is running and CORS is configured. You may need to refresh the page.')
      } else {
        setError(err.message || 'Request failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyCurl = () => {
    let url = selectedEndpoint
    pathParamNames.forEach(param => {
      const value = pathParams[param] || `:${param}`
      url = url.replace(`:${param}`, value)
    })

    let curl = `curl -X ${method} '${API_BASE}${url}' \\
  -H 'Authorization: Bearer ${apiKey || 'sk_test_xxx'}' \\
  -H 'Content-Type: application/json'`

    if (method !== 'GET' && body.trim() && body !== '{}') {
      curl += ` \\
  -d '${body.replace(/\n\s*/g, ' ')}'`
    }

    navigator.clipboard.writeText(curl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    return 'text-red-400 bg-red-500/10 border-red-500/20'
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-charcoal border-l border-white/10 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-obsidian">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
              <Terminal className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">API Playground</h2>
              <p className="text-[10px] text-slate-500">Test endpoints in real-time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* API Key */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-xs">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk_test_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400 pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Endpoint Selector */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-xs">Endpoint</Label>
            <Select value={selectedValue} onValueChange={setSelectedValue}>
              <SelectTrigger className="bg-obsidian border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-charcoal border-white/10 max-h-[400px]">
                {/* Group endpoints by category */}
                {Array.from(new Set(ENDPOINTS.map(e => e.category))).map((category) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      {category}
                    </div>
                    {ENDPOINTS.filter(ep => ep.category === category).map((ep) => (
                      <SelectItem
                        key={`${ep.method}-${ep.path}`}
                        value={`${ep.method}:${ep.path}`}
                        className="text-white hover:bg-white/5 focus:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <Badge className={`${methodColors[ep.method]} text-[10px] px-1.5 py-0`}>
                            {ep.method}
                          </Badge>
                          <span className="font-mono text-xs">{ep.path}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URL Preview */}
          <div className="p-3 rounded-lg bg-obsidian border border-white/10">
            <div className="flex items-center gap-2">
              <Badge className={`${methodColors[method]} font-mono text-xs`}>
                {method}
              </Badge>
              <code className="text-xs text-slate-400 font-mono truncate">
                {API_BASE}{selectedEndpoint}
              </code>
            </div>
          </div>

          {/* Path Parameters */}
          {hasPathParams && (
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Path Parameters</Label>
              {pathParamNames.map(param => (
                <div key={param} className="flex items-center gap-2">
                  <code className="text-cyan-400 text-xs min-w-[60px]">:{param}</code>
                  <Input
                    placeholder={`Enter ${param}...`}
                    value={pathParams[param] || ''}
                    onChange={(e) => setPathParams(prev => ({ ...prev, [param]: e.target.value }))}
                    className="bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400 font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Request Body */}
          {method !== 'GET' && (
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Request Body</Label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full h-48 bg-obsidian border border-white/10 rounded-lg p-3 text-xs font-mono text-cyan-400 focus:border-cyan-400 focus:outline-none resize-none"
                spellCheck={false}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={executeRequest}
              disabled={loading || !apiKey}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold h-10 rounded-lg shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={copyCurl}
              className="border-white/10 text-slate-300 hover:bg-white/5"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Label className="text-slate-300 text-xs">Response</Label>
                  <Badge className={`${getStatusColor(response.status)} font-mono text-xs`}>
                    {response.status}
                  </Badge>
                  <span className="text-xs text-slate-500">{response.duration}ms</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyResponse}
                  className="text-slate-400 hover:text-cyan-400 h-7 px-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-obsidian rounded-lg border border-white/10 p-3 max-h-64 overflow-auto">
                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                  {JSON.stringify(response.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Floating trigger button
export function ApiPlaygroundTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-200 group"
    >
      <Terminal className="h-5 w-5" />
      <span>Try API</span>
      <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
    </button>
  )
}
