'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Plus, ExternalLink, Trash2, RefreshCw, Webhook, Check, X, Play, Loader2, Copy, CheckCircle2, XCircle } from 'lucide-react'

// Sample webhook payloads for each event type
const WEBHOOK_PAYLOADS: Record<string, object> = {
  'payment.succeeded': {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'payment.succeeded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pay_' + Math.random().toString(36).substring(2, 10),
        amount: 4999,
        currency: 'usd',
        status: 'succeeded',
        payment_method: 'card',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2025 },
        metadata: { order_id: 'order_123' },
        created_at: new Date().toISOString(),
      }
    }
  },
  'payment.failed': {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'payment.failed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pay_' + Math.random().toString(36).substring(2, 10),
        amount: 4999,
        currency: 'usd',
        status: 'failed',
        failure_code: 'card_declined',
        failure_message: 'Your card was declined.',
        payment_method: 'card',
        card: { brand: 'visa', last4: '0002', exp_month: 12, exp_year: 2025 },
        created_at: new Date().toISOString(),
      }
    }
  },
  'payment.authorized': {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'payment.authorized',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pay_' + Math.random().toString(36).substring(2, 10),
        amount: 15000,
        currency: 'usd',
        status: 'authorized',
        payment_method: 'card',
        card: { brand: 'mastercard', last4: '5556', exp_month: 6, exp_year: 2026 },
        authorization_code: 'AUTH_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        created_at: new Date().toISOString(),
      }
    }
  },
  'payment.captured': {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'payment.captured',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pay_' + Math.random().toString(36).substring(2, 10),
        amount: 15000,
        amount_captured: 15000,
        currency: 'usd',
        status: 'captured',
        payment_method: 'card',
        card: { brand: 'mastercard', last4: '5556', exp_month: 6, exp_year: 2026 },
        captured_at: new Date().toISOString(),
      }
    }
  },
  'payment.canceled': {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'payment.canceled',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pay_' + Math.random().toString(36).substring(2, 10),
        amount: 7500,
        currency: 'usd',
        status: 'canceled',
        cancellation_reason: 'requested_by_customer',
        canceled_at: new Date().toISOString(),
      }
    }
  },
  'refund.created': {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'refund.created',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'ref_' + Math.random().toString(36).substring(2, 10),
        payment_id: 'pay_' + Math.random().toString(36).substring(2, 10),
        amount: 2500,
        currency: 'usd',
        status: 'pending',
        reason: 'requested_by_customer',
        created_at: new Date().toISOString(),
      }
    }
  },
  'refund.succeeded': {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'refund.succeeded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'ref_' + Math.random().toString(36).substring(2, 10),
        payment_id: 'pay_' + Math.random().toString(36).substring(2, 10),
        amount: 2500,
        currency: 'usd',
        status: 'succeeded',
        reason: 'requested_by_customer',
        created_at: new Date().toISOString(),
      }
    }
  },
  'subscription.created': {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'subscription.created',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'sub_' + Math.random().toString(36).substring(2, 10),
        customer_id: 'cus_' + Math.random().toString(36).substring(2, 10),
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ price_id: 'price_xxx', quantity: 1 }],
      }
    }
  },
  'invoice.paid': {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'invoice.paid',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'inv_' + Math.random().toString(36).substring(2, 10),
        customer_id: 'cus_' + Math.random().toString(36).substring(2, 10),
        subscription_id: 'sub_' + Math.random().toString(36).substring(2, 10),
        amount_paid: 2999,
        currency: 'usd',
        status: 'paid',
        paid_at: new Date().toISOString(),
      }
    }
  },
}

const ALL_EVENTS = Object.keys(WEBHOOK_PAYLOADS)

export default function WebhooksPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  // Simulator state
  const [simulatorUrl, setSimulatorUrl] = useState('')
  const [simulatorEvent, setSimulatorEvent] = useState('payment.succeeded')
  const [simulatorLoading, setSimulatorLoading] = useState(false)
  const [simulatorResult, setSimulatorResult] = useState<{ success: boolean; status?: number; message: string; duration?: number } | null>(null)
  const [copied, setCopied] = useState(false)

  const availableEvents = ['payment.captured', 'payment.failed', 'payment.authorized', 'payment.canceled', 'refund.succeeded']

  const [webhooks] = useState([
    {
      id: '1',
      url: 'https://api.merchant.com/webhooks/atlas',
      events: ['payment.captured', 'payment.failed'],
      status: 'active',
      lastDelivery: '2 minutes ago',
    },
  ])

  const [deliveries] = useState([
    {
      id: '1',
      event: 'payment.captured',
      status: 200,
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      event: 'payment.failed',
      status: 500,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
  ])

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    )
  }

  const copyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(WEBHOOK_PAYLOADS[simulatorEvent], null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendTestWebhook = async () => {
    if (!simulatorUrl) return

    setSimulatorLoading(true)
    setSimulatorResult(null)
    const startTime = Date.now()

    try {
      // Generate fresh payload with new IDs
      const payload = {
        ...WEBHOOK_PAYLOADS[simulatorEvent],
        id: 'evt_' + Math.random().toString(36).substring(2, 10),
        created: Math.floor(Date.now() / 1000),
      }

      const response = await fetch(simulatorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Atlas-Event': simulatorEvent,
          'X-Atlas-Signature': 't=' + Math.floor(Date.now() / 1000) + ',v1=' + Math.random().toString(36).substring(2, 34),
          'X-Atlas-Delivery': 'del_' + Math.random().toString(36).substring(2, 10),
        },
        body: JSON.stringify(payload),
      })

      const duration = Date.now() - startTime

      setSimulatorResult({
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Webhook delivered successfully' : `Server returned ${response.status}`,
        duration,
      })
    } catch (error: any) {
      const duration = Date.now() - startTime
      setSimulatorResult({
        success: false,
        message: error.message || 'Failed to connect to endpoint',
        duration,
      })
    } finally {
      setSimulatorLoading(false)
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Webhooks</h1>
          <p className="text-slate-500 mt-1">Real-time asynchronous event notifications</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-medium h-10 px-6 rounded-full shadow-lg shadow-cyan-500/20">
              <Plus className="h-4 w-4 mr-2" />
              Add Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-charcoal border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Add Webhook Endpoint</DialogTitle>
              <DialogDescription className="text-slate-400">
                Atlas will send POST requests to this URL when events occur
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="url" className="text-slate-300">Endpoint URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com/webhooks"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-slate-300">Subscribe to events</Label>
                <div className="flex flex-wrap gap-2">
                  {availableEvents.map((event) => (
                    <Badge
                      key={event}
                      onClick={() => toggleEvent(event)}
                      className={`cursor-pointer transition-all px-3 py-1 text-[11px] rounded-full border ${
                        selectedEvents.includes(event)
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                          : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10 hover:text-slate-300'
                      }`}
                    >
                      {selectedEvents.includes(event) && <Check className="h-3 w-3 mr-1.5" />}
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="border-white/10 text-slate-300 hover:bg-white/5 rounded-full px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowCreateDialog(false)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-full px-8"
              >
                Add Endpoint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Active Endpoints</h2>
            <p className="text-sm text-slate-500">Destination URLs for system events</p>
          </div>
        </div>
        {webhooks.length === 0 ? (
          <div className="py-20 text-center">
            <Webhook className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium mb-1">No webhooks configured</p>
            <p className="text-xs text-slate-600">Click &apos;Add Endpoint&apos; to start receiving notifications</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Destination URL</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Events</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Latency</th>
                  <th className="py-3 px-6"></th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((webhook) => (
                  <tr key={webhook.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="py-4 px-6">
                      <code className="text-sm text-cyan-400 bg-cyan-400/5 px-2 py-1 rounded font-mono">{webhook.url}</code>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-1.5 flex-wrap">
                        {webhook.events.map((event) => (
                          <Badge key={event} className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px] uppercase font-mono">
                            {event.split('.')[1]}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={webhook.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }>
                        {webhook.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-500 text-sm">{webhook.lastDelivery}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-full h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent Deliveries</h2>
            <p className="text-sm text-slate-500">History of dispatched event payloads</p>
          </div>
          <Button variant="outline" size="sm" className="border-white/10 text-slate-300 hover:bg-white/5 rounded-full px-4 h-8">
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Event Payload</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Response Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-4 px-6 font-mono text-sm text-slate-300">
                    {delivery.event}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${delivery.status === 200 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`} />
                      <span className={`text-sm font-medium ${delivery.status === 200 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {delivery.status} OK
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="text-slate-500 text-sm">
                      {new Date(delivery.timestamp).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook Simulator */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/20">
            <Play className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Webhook Simulator</h2>
            <p className="text-sm text-slate-500">Test your webhook integration with sample events</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Configuration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Endpoint URL</Label>
                <Input
                  placeholder="https://your-server.com/webhooks/atlas"
                  value={simulatorUrl}
                  onChange={(e) => setSimulatorUrl(e.target.value)}
                  className="bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Event Type</Label>
                <Select value={simulatorEvent} onValueChange={setSimulatorEvent}>
                  <SelectTrigger className="bg-obsidian border-white/10 text-white focus:border-cyan-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-charcoal border-white/10">
                    {ALL_EVENTS.map((event) => (
                      <SelectItem key={event} value={event} className="text-white hover:bg-white/5 focus:bg-white/5">
                        <span className="font-mono">{event}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={sendTestWebhook}
                disabled={!simulatorUrl || simulatorLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold h-11 rounded-full shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {simulatorLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Send Test Webhook
                  </>
                )}
              </Button>

              {/* Result */}
              {simulatorResult && (
                <div className={`rounded-xl p-4 flex items-start gap-3 ${
                  simulatorResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  {simulatorResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${simulatorResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {simulatorResult.message}
                    </p>
                    <div className="flex gap-4 mt-1 text-xs text-slate-500">
                      {simulatorResult.status && <span>Status: {simulatorResult.status}</span>}
                      {simulatorResult.duration && <span>Duration: {simulatorResult.duration}ms</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payload Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">Payload Preview</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyPayload}
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
              <div className="bg-obsidian rounded-xl border border-white/10 p-4 h-[320px] overflow-auto">
                <pre className="text-xs font-mono text-cyan-400 whitespace-pre-wrap">
                  {JSON.stringify(WEBHOOK_PAYLOADS[simulatorEvent], null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Headers Info */}
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
            <h4 className="text-sm font-medium text-white mb-3">Request Headers</h4>
            <div className="grid gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <code className="text-cyan-400">Content-Type:</code>
                <code className="text-slate-400">application/json</code>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-cyan-400">X-Atlas-Event:</code>
                <code className="text-slate-400">{simulatorEvent}</code>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-cyan-400">X-Atlas-Signature:</code>
                <code className="text-slate-400">t=timestamp,v1=hmac_signature</code>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-cyan-400">X-Atlas-Delivery:</code>
                <code className="text-slate-400">del_unique_id</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}