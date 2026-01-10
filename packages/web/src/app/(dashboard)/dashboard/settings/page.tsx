'use client'

import { useState, useEffect, useTransition } from 'react'
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
import { Building2, Globe, Shield, Bell, FlaskConical, Settings2, Loader2, Key, Plus, Copy, Eye, EyeOff, Trash2, AlertTriangle, RefreshCw } from 'lucide-react'
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
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#19d1c3]/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-[#19d1c3]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Business Information</h2>
            <p className="text-sm text-gray-500">Basic information about your business</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-gray-300">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail" className="text-gray-300">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Regional Settings */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#c8ff5a]/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-[#c8ff5a]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Regional Settings</h2>
            <p className="text-sm text-gray-500">Currency and timezone preferences</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-gray-300">Default Currency</Label>
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-white/10">
                  {CURRENCIES.map((currency) => (
                    <SelectItem
                      key={currency.code}
                      value={currency.code}
                      className="text-white hover:bg-white/5"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-gray-400">{currency.symbol}</span>
                        {currency.code} - {currency.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Used as the default for new payment sessions</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone" className="text-gray-300">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-white/10">
                  {TIMEZONES.map((tz) => (
                    <SelectItem
                      key={tz.value}
                      value={tz.value}
                      className="text-white hover:bg-white/5"
                    >
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Used for reports and transaction timestamps</p>
            </div>
          </div>
        </div>
      </div>

      {/* Environment */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Environment</h2>
            <p className="text-sm text-gray-500">Configure your test and production environments</p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-white/10">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <span className="text-sm font-bold text-amber-400">T</span>
              </div>
              <div>
                <p className="font-medium text-white">Test Mode</p>
                <p className="text-sm text-gray-500">No real transactions will be processed</p>
              </div>
            </div>
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Active</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Switch to Live mode in the Processors settings when you're ready to go live.
          </p>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <p className="text-sm text-gray-500">Configure how you receive updates</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Email Notifications</p>
              <p className="text-sm text-gray-500">Receive email alerts for important events</p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Webhook Notifications</p>
              <p className="text-sm text-gray-500">Send events to your webhook endpoints</p>
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
        <Button className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90 text-black font-semibold">
          Save Changes
        </Button>
      </div>
    </div>
  )
}

// ===== TEST PAYMENTS TAB =====
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

  // Load configured PSPs and API key
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

      // Load API key
      const { data: keys } = await supabase
        .from('api_keys')
        .select('key_hash, key_prefix')
        .eq('is_active', true)
        .limit(1)

      // Note: We can't get the full key, user needs to enter it
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
          <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-[#19d1c3]/10 flex items-center justify-center">
                <FlaskConical className="h-5 w-5 text-[#19d1c3]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Test Payment</h2>
                <p className="text-sm text-gray-500">Run an end-to-end payment test</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Payment Processor</Label>
                <Select value={selectedPsp} onValueChange={setSelectedPsp}>
                  <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                    <SelectValue placeholder="Select a processor" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-white/10">
                    {psps.length === 0 ? (
                      <SelectItem value="none" disabled className="text-gray-500">
                        No processors configured
                      </SelectItem>
                    ) : (
                      psps.map((p) => (
                        <SelectItem key={p.psp} value={p.psp} className="text-white hover:bg-white/5">
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
                <Label className="text-gray-300">API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_test_..."
                  className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-500">Enter your secret API key from the API Keys page</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-[#0a0a0a] border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111] border-white/10">
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code} className="text-white hover:bg-white/5">
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
                className="w-full bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90 text-black font-semibold"
              >
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : 'Create Payment Session'}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Enter Card Details</h2>
            <p className="text-sm text-gray-400 mb-4">
              Test card: <code className="text-[#19d1c3]">4111 1111 1111 1111</code>
            </p>

            <div className="rounded-lg overflow-hidden border border-white/10 mb-4">
              <iframe
                src={`http://localhost:3001?sessionId=${sessionId}&parentOrigin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
                className="w-full h-[400px] border-0"
                title="Payment form"
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
              className="w-full bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90 text-black font-semibold"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : `Pay ${currency} ${amount}`}
            </Button>
          </div>
        )}

        {step === 3 && result && (
          <div className="rounded-2xl bg-[#111] border border-green-500/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-green-400">Payment Successful!</h2>
                <p className="text-sm text-gray-400">Completed via {result.psp}</p>
              </div>
            </div>
            <pre className="text-xs bg-black/50 p-4 rounded-lg overflow-auto max-h-60 mb-4">
              {JSON.stringify(result, null, 2)}
            </pre>
            <Button onClick={resetTest} variant="outline" className="w-full border-white/10 text-gray-300 hover:bg-white/5">
              Run Another Test
            </Button>
          </div>
        )}
      </div>

      {/* Right: Logs */}
      <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Event Log</h2>
        <div className="bg-black/50 rounded-lg p-4 h-[500px] overflow-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-gray-500">Waiting for events...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-gray-300 mb-1">{log}</div>
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
      <div className="rounded-xl bg-gradient-to-br from-[#19d1c3]/10 to-[#c8ff5a]/10 border border-[#19d1c3]/20 p-4 flex items-start gap-3">
        <Key className="h-5 w-5 text-[#19d1c3] mt-0.5" />
        <div>
          <h3 className="font-medium text-white">How API Keys Work</h3>
          <p className="text-sm text-gray-400 mt-1">
            Use <code className="text-[#19d1c3]">sk_test_</code> keys for development and <code className="text-[#19d1c3]">sk_live_</code> keys for production.
            Include your key in the <code className="text-[#19d1c3]">Authorization: Bearer</code> header.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Active Keys</h2>
            <p className="text-sm text-gray-500 mt-1">Keys are used to authenticate API requests. Keep them secret!</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={loadKeys}
              disabled={loading}
              className="border-white/10 text-gray-300 hover:bg-white/5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Key
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#111] border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-white">Create API Key</DialogTitle>
                  <DialogDescription className="text-gray-400">
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
                        <Label htmlFor="label" className="text-gray-300">Label</Label>
                        <Input
                          id="label"
                          placeholder="e.g., Production Server"
                          value={newKeyLabel}
                          onChange={(e) => setNewKeyLabel(e.target.value)}
                          className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="environment" className="text-gray-300">Environment</Label>
                        <Select
                          value={newKeyEnvironment}
                          onValueChange={(value) => setNewKeyEnvironment(value as 'test' | 'live')}
                        >
                          <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#111] border-white/10">
                            <SelectItem value="test" className="text-white hover:bg-white/5">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Test</Badge>
                                <span>For development and testing</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="live" className="text-white hover:bg-white/5">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Live</Badge>
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
                        className="border-white/10 text-gray-300 hover:bg-white/5"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateKey}
                        disabled={isPending || !newKeyLabel.trim()}
                        className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
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
                        <p className="text-sm text-amber-400">
                          Save this key now - you won&apos;t be able to see it again!
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-300">Your new API key</Label>
                        <div className="flex gap-2">
                          <Input
                            type={showKey ? 'text' : 'password'}
                            value={newKeyResult.full_key}
                            readOnly
                            className="font-mono bg-[#0a0a0a] border-white/10 text-white"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowKey(!showKey)}
                            className="border-white/10 text-gray-300 hover:bg-white/5"
                          >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(newKeyResult.full_key)}
                            className="border-white/10 text-gray-300 hover:bg-white/5"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        {copied && (
                          <p className="text-sm text-green-400">Copied to clipboard!</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={resetDialog}
                        className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
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
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Environment</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="h-8 w-8 text-[#19d1c3] animate-spin mb-4" />
                      <p className="text-gray-400">Loading API keys...</p>
                    </div>
                  </td>
                </tr>
              ) : apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                        <Key className="h-6 w-6 text-gray-500" />
                      </div>
                      <p className="text-gray-400 mb-2">No API keys yet</p>
                      <p className="text-sm text-gray-500">Create your first API key to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-medium text-white">{key.label || 'Unnamed Key'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <code className="text-sm text-[#19d1c3] bg-[#19d1c3]/10 px-2 py-1 rounded">{key.key_prefix}...</code>
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={key.environment === 'live'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }>
                        {key.environment}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-400">{formatLastUsed(key.last_used_at)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-500 text-sm">{formatDate(key.created_at)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={isPending}
                        className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
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

// ===== MAIN PAGE =====
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account, API keys, and test payments</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-[#111] border border-white/10 p-1">
          <TabsTrigger value="general" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            <Settings2 className="h-4 w-4 mr-2" />General
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            <Key className="h-4 w-4 mr-2" />API Keys
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            <FlaskConical className="h-4 w-4 mr-2" />Test Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsTab />
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeysTab />
        </TabsContent>

        <TabsContent value="test">
          <TestPaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
