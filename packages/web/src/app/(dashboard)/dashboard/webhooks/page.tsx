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

  // Mock webhooks
  const [webhooks] = useState([
    {
      id: '1',
      url: 'https://example.com/webhooks/atlas',
      events: ['payment.captured', 'payment.failed'],
      status: 'active',
      lastDelivery: '2 minutes ago',
    },
  ])

  // Mock recent deliveries
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhooks</h1>
          <p className="text-gray-500 mt-1">Receive real-time notifications for payment events</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Add Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111] border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">Add Webhook Endpoint</DialogTitle>
              <DialogDescription className="text-gray-400">
                We&apos;ll send POST requests to this URL when events occur
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="url" className="text-gray-300">Endpoint URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com/webhooks"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Events to listen for</Label>
                <div className="flex flex-wrap gap-2">
                  {availableEvents.map((event) => (
                    <Badge
                      key={event}
                      onClick={() => toggleEvent(event)}
                      className={`cursor-pointer transition-colors ${
                        selectedEvents.includes(event)
                          ? 'bg-[#19d1c3]/20 text-[#19d1c3] border-[#19d1c3]/30'
                          : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {selectedEvents.includes(event) && <Check className="h-3 w-3 mr-1" />}
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowCreateDialog(false)}
                className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
              >
                Add Endpoint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhook Endpoints */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Endpoints</h2>
          <p className="text-sm text-gray-500 mt-1">Active webhook endpoints</p>
        </div>
        {webhooks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                <Webhook className="h-6 w-6 text-gray-500" />
              </div>
              <p className="text-gray-400 mb-2">No webhooks configured yet</p>
              <p className="text-sm text-gray-500">Add an endpoint to receive payment notifications</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Events</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Delivery</th>
                  <th className="py-3 px-6"></th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((webhook) => (
                  <tr key={webhook.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6">
                      <code className="text-sm text-[#19d1c3]">{webhook.url}</code>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-1 flex-wrap">
                        {webhook.events.map((event) => (
                          <Badge key={event} className="bg-white/5 text-gray-300 border-white/10">
                            {event.split('.')[1]}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={webhook.status === 'active'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }>
                        {webhook.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-400">{webhook.lastDelivery}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
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

      {/* Recent Deliveries */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent Deliveries</h2>
            <p className="text-sm text-gray-500 mt-1">Latest webhook delivery attempts</p>
          </div>
          <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:bg-white/5">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-6">
                    <Badge className="bg-white/5 text-gray-300 border-white/10">{delivery.event}</Badge>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {delivery.status === 200 ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <X className="h-4 w-4 text-red-400" />
                      )}
                      <Badge className={delivery.status === 200
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }>
                        {delivery.status}
                      </Badge>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-500 text-sm">
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