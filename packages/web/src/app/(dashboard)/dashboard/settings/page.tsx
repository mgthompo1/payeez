'use client'

import { useState, useEffect, useTransition, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, Globe, Shield, Bell, FlaskConical, Settings2, Loader2, Key, Plus, Copy, Eye, EyeOff, Trash2, AlertTriangle, RefreshCw, Puzzle, Package, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getApiKeys, createApiKey, revokeApiKey, onboardUser, type ApiKey, type CreateKeyResult } from '../api-keys/actions'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
]

const TIMEZONES = [
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
]

// ===== GENERAL SETTINGS TAB =====
function GeneralSettingsTab() {
  const [businessName, setBusinessName] = useState('My Business')
  const [supportEmail, setSupportEmail] = useState('support@mybusiness.com')
  const [defaultCurrency, setDefaultCurrency] = useState('NZD')
  const [timezone, setTimezone] = useState('Pacific/Auckland')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [webhookNotifications, setWebhookNotifications] = useState(true)

  return (
    <div className="grid gap-6">
      {/* Business Information */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
            <Building2 className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Business Information</h2>
            <p className="text-sm text-slate-500">Basic information about your business</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-slate-300">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="bg-obsidian border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail" className="text-slate-300">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(e) => supportEmail && setSupportEmail(e.target.value)}
                className="bg-obsidian border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Regional Settings */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Globe className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Regional Settings</h2>
            <p className="text-sm text-slate-500">Currency and timezone preferences</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-slate-300">Default Currency</Label>
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                <SelectTrigger className="bg-obsidian border-white/10 text-white focus:border-cyan-400 focus:ring-cyan-400/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-charcoal border-white/10">
                  {CURRENCIES.map((currency) => (
                    <SelectItem
                      key={currency.code}
                      value={currency.code}
                      className="text-white hover:bg-white/5 focus:bg-white/5"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-slate-400">{currency.symbol}</span>
                        {currency.code} - {currency.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Used as the default for new payment sessions</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone" className="text-slate-300">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="bg-obsidian border-white/10 text-white focus:border-cyan-400 focus:ring-cyan-400/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-charcoal border-white/10">
                  {TIMEZONES.map((tz) => (
                    <SelectItem
                      key={tz.value}
                      value={tz.value}
                      className="text-white hover:bg-white/5 focus:bg-white/5"
                    >
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Used for reports and transaction timestamps</p>
            </div>
          </div>
        </div>
      </div>

      {/* Environment */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Shield className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Environment</h2>
            <p className="text-sm text-slate-500">Configure your test and production environments</p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-obsidian border border-white/10">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <span className="text-sm font-bold text-amber-400">T</span>
              </div>
              <div>
                <p className="font-medium text-white">Test Mode</p>
                <p className="text-sm text-slate-500">No real transactions will be processed</p>
              </div>
            </div>
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.2)]">Active</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Switch to Live mode in the Processors settings when you're ready to go live.
          </p>
        </div>
      </div>

      {/* Notifications */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Bell className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <p className="text-sm text-slate-500">Configure how you receive updates</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Email Notifications</p>
              <p className="text-sm text-slate-500">Receive email alerts for important events</p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Webhook Notifications</p>
              <p className="text-sm text-slate-500">Send events to your webhook endpoints</p>
            </div>
            <Switch
              checked={webhookNotifications}
              onCheckedChange={setWebhookNotifications}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold shadow-lg shadow-cyan-500/20 h-11 px-8 rounded-full transition-all">
          Save Changes
        </Button>
      </div>
    </div>
  )
}

// ===== TEST PAYMENTS TAB =====
const ELEMENTS_URL = process.env.NEXT_PUBLIC_ELEMENTS_URL || 'http://localhost:3001'

function TestPaymentsTab() {
  const [psps, setPsps] = useState<Array<{ psp: string; environment: string }>>([])
  const [selectedPsp, setSelectedPsp] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [amount, setAmount] = useState('10.00')
  const [currency, setCurrency] = useState('NZD')
  const [step, setStep] = useState(1)
  const [sessionId, setSessionId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])

  const functionsUrl = `${SUPABASE_URL}/functions/v1`

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  // Persist API key to localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('atlas_test_api_key')
    if (savedKey) {
      setApiKey(savedKey)
    }
  }, [])

  const handleApiKeyChange = (value: string) => {
    setApiKey(value)
    if (value) {
      localStorage.setItem('atlas_test_api_key', value)
    } else {
      localStorage.removeItem('atlas_test_api_key')
    }
  }

  // Load configured PSPs
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()

      // Load PSP credentials
      const { data: creds } = await supabase
        .from('psp_credentials')
        .select('psp, environment')
        .eq('is_active', true)

      if (creds && creds.length > 0) {
        setPsps(creds)
        setSelectedPsp(creds[0].psp)
      }
    }
    loadData()
  }, [])

  // Create session
  const createSession = async () => {
    if (!apiKey) {
      setError('Please enter your API key')
      return
    }
    if (!selectedPsp) {
      setError('Please select a payment processor')
      return
    }

    setLoading(true)
    setError('')
    addLog(`Creating payment session for ${selectedPsp}...`)

    try {
      const res = await fetch(`${functionsUrl}/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          amount: Math.round(parseFloat(amount) * 100),
          currency: currency,
          capture_method: 'automatic',
          psp: selectedPsp, // Force specific PSP
          metadata: {
            order_id: 'test-' + Date.now(),
            test_payment: true,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session')
      }

      addLog(`Session created: ${data.id}`)
      addLog(`Client secret: ${data.client_secret?.slice(0, 20)}...`)
      setSessionId(data.id)
      setClientSecret(data.client_secret)
      setStep(2)
    } catch (err: any) {
      setError(err.message)
      addLog(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Listen for iframe messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {}

      switch (type) {
        case 'ATLAS_READY':
          addLog('Payment form ready')
          break
        case 'ATLAS_CHANGE':
          if (payload?.complete) {
            addLog('Form complete - ready to submit')
          }
          break
        case 'ATLAS_TOKEN_CREATED':
          addLog(`Token created: ${payload?.tokenId}`)
          confirmPayment(payload?.tokenId)
          break
        case 'ATLAS_ERROR':
          addLog(`Form error: ${payload?.message}`)
          setError(payload?.message)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sessionId, clientSecret, selectedPsp])

  // Confirm payment
  const confirmPayment = async (tokenId: string) => {
    addLog(`Confirming payment with ${selectedPsp}...`)
    setLoading(true)

    try {
      const res = await fetch(`${functionsUrl}/confirm-payment/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clientSecret}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          token_id: tokenId,
          token_provider: 'atlas',
          psp: selectedPsp, // Force specific PSP
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMsg = data.error || data.message || 'Payment failed'
        const errorCode = data.code || data.failure_code || ''
        const errorDetails = data.attempts ? `(${data.attempts} attempts, last PSP: ${data.last_psp})` : ''
        throw new Error(`${errorMsg} ${errorCode} ${errorDetails}`.trim())
      }

      addLog(`Payment ${data.status}: ${data.psp_transaction_id || data.id}`)
      setResult(data)
      setStep(3)
    } catch (err: any) {
      setError(err.message)
      addLog(`Payment error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const submitPayment = () => {
    const iframe = document.querySelector('iframe')
    if (iframe?.contentWindow) {
      addLog('Submitting payment form...')
      iframe.contentWindow.postMessage({ type: 'ATLAS_CONFIRM' }, '*')
    }
  }

  const resetTest = () => {
    setStep(1)
    setSessionId('')
    setClientSecret('')
    setResult(null)
    setError('')
    setLogs([])
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Test Form */}
      <div className="space-y-6">
        {step === 1 && (
          <div className="dashboard-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <FlaskConical className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Test Payment</h2>
                <p className="text-sm text-slate-500">Run an end-to-end payment test</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Payment Processor</Label>
                <Select value={selectedPsp} onValueChange={setSelectedPsp}>
                  <SelectTrigger className="bg-obsidian border-white/10 text-white focus:border-cyan-400">
                    <SelectValue placeholder="Select a processor" />
                  </SelectTrigger>
                  <SelectContent className="bg-charcoal border-white/10">
                    {psps.length === 0 ? (
                      <SelectItem value="none" disabled className="text-slate-500">
                        No processors configured
                      </SelectItem>
                    ) : (
                      psps.map((p) => (
                        <SelectItem key={p.psp} value={p.psp} className="text-white hover:bg-white/5 focus:bg-white/5">
                          <span className="flex items-center gap-2">
                            {p.psp.charAt(0).toUpperCase() + p.psp.slice(1)}
                            <Badge className={p.environment === 'live'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }>
                              {p.environment}
                            </Badge>
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="sk_test_..."
                  className="bg-obsidian border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400"
                />
                <p className="text-xs text-slate-500">Enter your secret API key from the API Keys tab (saved automatically)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-obsidian border-white/10 text-white focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="bg-obsidian border-white/10 text-white focus:border-cyan-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-charcoal border-white/10">
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code} className="text-white hover:bg-white/5 focus:bg-white/5">
                          {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Button
                onClick={createSession}
                disabled={loading || !selectedPsp || !apiKey}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold h-11 rounded-full shadow-lg shadow-cyan-500/20"
              >
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : 'Create Payment Session'}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="dashboard-card p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Enter Card Details</h2>
            <p className="text-sm text-slate-400 mb-4">
              Test card: <code className="text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">4111 1111 1111 1111</code>
            </p>

            <div className="rounded-lg overflow-hidden border border-white/10 mb-4 bg-white">
              <iframe
                src={`${ELEMENTS_URL}?sessionId=${sessionId}&parentOrigin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
                className="w-full h-[320px] border-0"
                title="Payment form"
                allow="payment"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 mb-4">
                {error}
              </div>
            )}

            <Button
              onClick={submitPayment}
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold h-11 rounded-full shadow-lg shadow-cyan-500/20"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : `Pay ${currency} ${amount}`}
            </Button>
          </div>
        )}

        {step === 3 && result && (
          <div className="dashboard-card border-cyan-500/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/20">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-green-400">Payment Successful!</h2>
                <p className="text-sm text-slate-400">Completed via {result.psp}</p>
              </div>
            </div>
            <pre className="text-xs bg-obsidian p-4 rounded-lg overflow-auto max-h-60 mb-4 text-slate-300 border border-white/5 font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
            <Button onClick={resetTest} variant="outline" className="w-full border-white/10 text-slate-300 hover:bg-white/5 hover:text-cyan-400 hover:border-cyan-500/30 rounded-full">
              Run Another Test
            </Button>
          </div>
        )}
      </div>

      {/* Right: Logs */}
      <div className="dashboard-card p-6 flex flex-col h-full min-h-[500px]">
        <h2 className="text-lg font-semibold text-white mb-4">Event Log</h2>
        <div className="bg-obsidian rounded-lg p-4 flex-1 overflow-auto font-mono text-xs border border-white/5">
          {logs.length === 0 ? (
            <p className="text-slate-600 italic">Waiting for events...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-slate-300 mb-1 border-l border-cyan-500/30 pl-3 py-0.5">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ===== API KEYS TAB =====
function ApiKeysTab() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyEnvironment, setNewKeyEnvironment] = useState<'test' | 'live'>('test')
  const [newKeyResult, setNewKeyResult] = useState<CreateKeyResult | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadKeys = async () => {
    setLoading(true)
    setError(null)
    try {
      const keys = await getApiKeys()
      setApiKeys(keys.filter(k => !k.is_revoked))
    } catch (err) {
      setError('Failed to load API keys')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeys()
  }, [])

  const handleCreateKey = async () => {
    if (!newKeyLabel.trim()) {
      setError('Please enter a label for the key')
      return
    }

    startTransition(async () => {
      try {
        const result = await createApiKey(newKeyLabel, newKeyEnvironment)
        if (result) {
          setNewKeyResult(result)
          await loadKeys()
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create API key'

        if (message.includes('does not belong to any tenant')) {
          try {
            await onboardUser()
            const result = await createApiKey(newKeyLabel, newKeyEnvironment)
            if (result) {
              setNewKeyResult(result)
              await loadKeys()
            }
            return
          } catch (onboardErr) {
            setError('Failed to set up your account. Please try again.')
            return
          }
        }

        setError(message)
      }
    })
  }

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return
    }

    startTransition(async () => {
      try {
        await revokeApiKey(keyId)
        await loadKeys()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to revoke API key')
      }
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatLastUsed = (date: string | null) => {
    if (!date) return 'Never'
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hours ago`
    const days = Math.floor(hours / 24)
    return `${days} days ago`
  }

  const resetDialog = () => {
    setShowCreateDialog(false)
    setNewKeyResult(null)
    setNewKeyLabel('')
    setNewKeyEnvironment('test')
    setShowKey(false)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Info about API Keys */}
      <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 p-4 flex items-start gap-3">
        <Key className="h-5 w-5 text-cyan-400 mt-0.5" />
        <div>
          <h3 className="font-medium text-white">How API Keys Work</h3>
          <p className="text-sm text-slate-400 mt-1">
            Use <code className="text-cyan-400">sk_test_</code> keys for development and <code className="text-cyan-400">sk_live_</code> keys for production.
            Include your key in the <code className="text-cyan-400">Authorization: Bearer</code> header.
          </p>
        </div>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Active Keys</h2>
            <p className="text-sm text-slate-500 mt-1">Keys are used to authenticate API requests. Keep them secret!</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={loadKeys}
              disabled={loading}
              className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-cyan-400"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-medium shadow-lg shadow-cyan-500/20 h-10 px-5 rounded-full transition-all">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Key
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-charcoal border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white">Create API Key</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Create a new API key for authenticating requests
                  </DialogDescription>
                </DialogHeader>
                {!newKeyResult ? (
                  <>
                    <div className="space-y-4 py-4">
                      {error && (
                        <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                          {error}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="label" className="text-slate-300">Label</Label>
                        <Input
                          id="label"
                          placeholder="e.g., Production Server"
                          value={newKeyLabel}
                          onChange={(e) => setNewKeyLabel(e.target.value)}
                          className="bg-obsidian border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="environment" className="text-slate-300">Environment</Label>
                        <Select
                          value={newKeyEnvironment}
                          onValueChange={(value) => setNewKeyEnvironment(value as 'test' | 'live')}
                        >
                          <SelectTrigger className="bg-obsidian border-white/10 text-white focus:border-cyan-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-charcoal border-white/10">
                            <SelectItem value="test" className="text-white hover:bg-white/5 focus:bg-white/5">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Test</Badge>
                                <span>For development and testing</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="live" className="text-white hover:bg-white/5 focus:bg-white/5">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">Live</Badge>
                                <span>For production use</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={resetDialog}
                        className="border-white/10 text-slate-300 hover:bg-white/5 rounded-full"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateKey}
                        disabled={isPending || !newKeyLabel.trim()}
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold rounded-full px-6"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Key'
                        )}
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <div className="space-y-4 py-4">
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-400 font-medium">
                          Save this key now - you won&apos;t be able to see it again!
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Your new API key</Label>
                        <div className="flex gap-2">
                          <Input
                            type={showKey ? 'text' : 'password'}
                            value={newKeyResult.full_key}
                            readOnly
                            className="font-mono bg-obsidian border-white/10 text-white focus:border-cyan-400"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowKey(!showKey)}
                            className="border-white/10 text-slate-300 hover:bg-white/5"
                          >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(newKeyResult.full_key)}
                            className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-cyan-400"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        {copied && (
                          <p className="text-sm text-cyan-400 font-medium">Copied to clipboard!</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={resetDialog}
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold rounded-full px-8"
                      >
                        Done
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Label</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Key</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Environment</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Used</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                <th className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mb-4" />
                      <p className="text-slate-400">Loading API keys...</p>
                    </div>
                  </td>
                </tr>
              ) : apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                        <Key className="h-6 w-6 text-slate-500" />
                      </div>
                      <p className="text-slate-400 mb-2">No API keys yet</p>
                      <p className="text-sm text-slate-500">Create your first API key to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="py-4 px-6">
                      <span className="font-medium text-white group-hover:text-cyan-400 transition-colors">{key.label || 'Unnamed Key'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <code className="text-sm text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded font-mono">{key.key_prefix}...</code>
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={key.environment === 'live'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }>
                        {key.environment}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-400">{formatLastUsed(key.last_used_at)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-500 text-sm">{formatDate(key.created_at)}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={isPending}
                        className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all rounded-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===== INTEGRATIONS TAB =====
const integrationStatusStyles: Record<string, string> = {
  available: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  scaffold: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  planned: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

function IntegrationsTab() {
  const commerceIntegrations = [
    {
      name: 'WooCommerce',
      status: 'scaffold',
      description: 'Drop-in gateway plugin with Atlas sessions + tokenization.',
      path: 'packages/integrations/atlas-woocommerce',
    },
    {
      name: 'Salesforce Commerce',
      status: 'scaffold',
      description: 'SFRA cartridge with payment sessions, 3DS, and webhooks.',
      path: 'packages/integrations/atlas-salesforce-commerce-cloud',
    },
    {
      name: 'Salesforce OMS',
      status: 'scaffold',
      description: 'Apex classes and LWC for Order Management payments.',
      path: 'packages/integrations/atlas-salesforce-oms',
    },
    {
      name: 'Shopware 6',
      status: 'scaffold',
      description: 'Payment app with checkout and admin configuration.',
      path: 'packages/integrations/shopware',
    },
  ]

  const mobileIntegrations = [
    {
      name: 'iOS (Swift)',
      status: 'planned',
      description: 'Native components for Apple Pay + card tokenization.',
    },
    {
      name: 'React Native',
      status: 'planned',
      description: 'Cross-platform drop-in UI with Atlas Elements.',
    },
    {
      name: 'Flutter',
      status: 'planned',
      description: 'Flutter plugin for Elements and confirmation flow.',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Commerce Platforms */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
            <Package className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Commerce Platforms</h2>
            <p className="text-sm text-slate-500">Scaffolds and starter kits for common platforms</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {commerceIntegrations.map((integration) => (
              <div key={integration.name} className="rounded-xl border border-white/10 bg-obsidian/50 p-4 space-y-2 hover:border-cyan-500/30 transition-all cursor-default group">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">{integration.name}</div>
                  <Badge className={integrationStatusStyles[integration.status]}>
                    {integration.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500">{integration.description}</p>
                <div className="text-xs text-slate-400">
                  <code className="text-cyan-400 bg-cyan-400/5 px-1.5 py-0.5 rounded font-mono">{integration.path}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile SDKs */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Smartphone className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Mobile SDKs</h2>
            <p className="text-sm text-slate-500">Native drop-in components with tokenization</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            {mobileIntegrations.map((integration) => (
              <div key={integration.name} className="rounded-xl border border-white/10 bg-obsidian/50 p-4 space-y-2 hover:border-blue-500/30 transition-all cursor-default group">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">{integration.name}</div>
                  <Badge className={integrationStatusStyles[integration.status]}>
                    {integration.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500">{integration.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Integration CTA */}
      <div className="dashboard-card bg-gradient-to-br from-slate-900/50 via-slate-950/50 to-slate-900/50 border-cyan-500/20 p-6 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-white">Need a custom integration?</div>
          <div className="text-sm text-slate-500">We can build bespoke adapters for ERPs, PSPs, and platforms.</div>
        </div>
        <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold rounded-full px-6 h-10 shadow-lg shadow-cyan-500/20 transition-all">
          Contact Support
        </Button>
      </div>
    </div>
  )
}

// ===== SETTINGS TABS CONTENT =====
function SettingsTabs() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'general'

  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
      <TabsList className="bg-charcoal border border-white/10 p-1 h-11 rounded-xl">
        <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 font-medium transition-all px-4">
          <Settings2 className="h-4 w-4 mr-2" />General
        </TabsTrigger>
        <TabsTrigger value="api-keys" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 font-medium transition-all px-4">
          <Key className="h-4 w-4 mr-2" />API Keys
        </TabsTrigger>
        <TabsTrigger value="integrations" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 font-medium transition-all px-4">
          <Puzzle className="h-4 w-4 mr-2" />Integrations
        </TabsTrigger>
        <TabsTrigger value="test" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 font-medium transition-all px-4">
          <FlaskConical className="h-4 w-4 mr-2" />Test Payments
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralSettingsTab />
      </TabsContent>

      <TabsContent value="api-keys">
        <ApiKeysTab />
      </TabsContent>

      <TabsContent value="integrations">
        <IntegrationsTab />
      </TabsContent>

      <TabsContent value="test">
        <TestPaymentsTab />
      </TabsContent>
    </Tabs>
  )
}

// ===== MAIN PAGE =====
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="dashboard-heading text-2xl">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account, API keys, and integrations</p>
      </div>

      <Suspense fallback={<div className="h-10 dashboard-card animate-pulse" />}>
        <SettingsTabs />
      </Suspense>
    </div>
  )
}