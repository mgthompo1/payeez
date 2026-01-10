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
import { Plus, ExternalLink, Trash2, RefreshCw, Webhook, Check, X } from 'lucide-react'

export default function WebhooksPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

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
    </div>
  )
}