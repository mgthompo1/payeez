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
  { method: 'POST', path: '/create-session', label: 'Create Session' },
  { method: 'GET', path: '/get-session/:id', label: 'Get Session' },
  { method: 'POST', path: '/confirm-payment/:id', label: 'Confirm Payment' },
  { method: 'POST', path: '/capture-payment/:id', label: 'Capture Payment' },
  { method: 'POST', path: '/refund-payment/:id', label: 'Refund Payment' },
  { method: 'POST', path: '/customers', label: 'Create Customer' },
  { method: 'GET', path: '/customers', label: 'List Customers' },
  { method: 'POST', path: '/products', label: 'Create Product' },
  { method: 'GET', path: '/products', label: 'List Products' },
  { method: 'POST', path: '/prices', label: 'Create Price' },
  { method: 'POST', path: '/subscriptions', label: 'Create Subscription' },
  { method: 'POST', path: '/invoices', label: 'Create Invoice' },
  { method: 'POST', path: '/bank-accounts', label: 'Create Bank Account' },
  { method: 'GET', path: '/bank-accounts', label: 'List Bank Accounts' },
]

const DEFAULT_BODIES: Record<string, object> = {
  '/create-session': {
    amount: 4990,
    currency: 'USD',
    customer: { email: 'test@example.com', name: 'Test User' },
    metadata: { order_id: 'order_123' }
  },
  '/customers': {
    email: 'customer@example.com',
    name: 'John Doe',
    metadata: { source: 'api_playground' }
  },
  '/products': {
    name: 'Test Product',
    description: 'A test product',
    metadata: { tier: 'basic' }
  },
  '/prices': {
    product: 'prod_xxx',
    currency: 'usd',
    unit_amount: 2999,
    type: 'recurring',
    recurring: { interval: 'month' }
  },
  '/subscriptions': {
    customer: 'cus_xxx',
    items: [{ price: 'price_xxx', quantity: 1 }],
    trial_period_days: 14
  },
  '/invoices': {
    customer: 'cus_xxx',
    collection_method: 'send_invoice',
    days_until_due: 30
  },
}

export function ApiPlayground({ isOpen, onClose, initialEndpoint, initialMethod, initialBody }: ApiPlaygroundProps) {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedEndpoint, setSelectedEndpoint] = useState(initialEndpoint || '/create-session')
  const [method, setMethod] = useState<string>(initialMethod || 'POST')
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

    // Find the method for this endpoint
    const endpoint = ENDPOINTS.find(e => e.path === selectedEndpoint)
    if (endpoint) {
      setMethod(endpoint.method)
    }
  }, [selectedEndpoint, initialBody])

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
      setError(err.message || 'Request failed')
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
            <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
              <SelectTrigger className="bg-obsidian border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-charcoal border-white/10">
                {ENDPOINTS.map((ep) => (
                  <SelectItem
                    key={ep.path}
                    value={ep.path}
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
