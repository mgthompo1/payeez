'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

const PSP_LIST = [
  { id: 'stripe', name: 'Stripe', connected: true },
  { id: 'adyen', name: 'Adyen', connected: false },
  { id: 'braintree', name: 'Braintree', connected: false },
  { id: 'checkoutcom', name: 'Checkout.com', connected: false },
  { id: 'authorizenet', name: 'Authorize.net', connected: false },
  { id: 'nuvei', name: 'Nuvei', connected: false },
  { id: 'dlocal', name: 'dLocal', connected: false },
  { id: 'chase', name: 'Chase', connected: false },
  { id: 'airwallex', name: 'Airwallex', connected: false },
]

export default function SettingsPage() {
  const [businessName, setBusinessName] = useState('My Business')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500">Manage your account and payment processors</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="processors">Payment Processors</TabsTrigger>
          <TabsTrigger value="routing">Routing Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Basic information about your business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Basis Theory</CardTitle>
              <CardDescription>Card tokenization configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Public Key</p>
                  <p className="text-sm text-gray-500 font-mono">key_test_us_pub_QSn...GV</p>
                </div>
                <Badge>Connected</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Processors</CardTitle>
              <CardDescription>
                Configure your payment processor credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {PSP_LIST.map((psp) => (
                  <div
                    key={psp.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-600">
                          {psp.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{psp.name}</p>
                        <p className="text-sm text-gray-500">
                          {psp.connected ? 'Connected' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    <Button variant={psp.connected ? 'outline' : 'default'}>
                      {psp.connected ? 'Configure' : 'Connect'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Routing Rules</CardTitle>
              <CardDescription>
                Configure how payments are routed to different processors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <p>No routing rules configured yet.</p>
                <p className="text-sm">Payments will be sent to the first available processor.</p>
                <Button className="mt-4">Add Routing Rule</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
