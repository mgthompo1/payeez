'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, Globe, Shield, Bell, FlaskConical, Settings2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

// ===== MAIN PAGE =====
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and test payments</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-[#111] border border-white/10 p-1">
          <TabsTrigger value="general" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            <Settings2 className="h-4 w-4 mr-2" />General
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
            <FlaskConical className="h-4 w-4 mr-2" />Test Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsTab />
        </TabsContent>

        <TabsContent value="test">
          <TestPaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
