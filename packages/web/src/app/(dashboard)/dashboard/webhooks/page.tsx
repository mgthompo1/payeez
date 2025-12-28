'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, ExternalLink, Trash2, RefreshCw } from 'lucide-react'

export default function WebhooksPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')

  // Mock webhooks
  const [webhooks] = useState([
    {
      id: '1',
      url: 'https://example.com/webhooks/payeez',
      events: ['payment.succeeded', 'payment.failed'],
      status: 'active',
      lastDelivery: '2 minutes ago',
    },
  ])

  // Mock recent deliveries
  const [deliveries] = useState([
    {
      id: '1',
      event: 'payment.succeeded',
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-gray-500">Receive real-time notifications for payment events</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Webhook Endpoint</DialogTitle>
              <DialogDescription>
                We&apos;ll send POST requests to this URL when events occur
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com/webhooks"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Events to listen for</Label>
                <div className="flex flex-wrap gap-2">
                  {['payment.succeeded', 'payment.failed', 'refund.succeeded'].map((event) => (
                    <Badge key={event} variant="outline" className="cursor-pointer">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowCreateDialog(false)}>
                Add Endpoint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhook Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>Active webhook endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No webhooks configured yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Delivery</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-mono text-sm">
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline">
                            {event.split('.')[1]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                        {webhook.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{webhook.lastDelivery}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Deliveries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Deliveries</CardTitle>
            <CardDescription>Latest webhook delivery attempts</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>
                    <Badge variant="outline">{delivery.event}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={delivery.status === 200 ? 'default' : 'destructive'}>
                      {delivery.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(delivery.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
