'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building2, CreditCard, Route, Check, ArrowRight } from 'lucide-react'

const PSP_LIST = [
  { id: 'stripe', name: 'Stripe', connected: true, icon: 'ST' },
  { id: 'adyen', name: 'Adyen', connected: false, icon: 'AD' },
  { id: 'braintree', name: 'Braintree', connected: false, icon: 'BT' },
  { id: 'checkoutcom', name: 'Checkout.com', connected: false, icon: 'CO' },
  { id: 'authorizenet', name: 'Authorize.net', connected: false, icon: 'AN' },
  { id: 'nuvei', name: 'Nuvei', connected: false, icon: 'NV' },
  { id: 'dlocal', name: 'dLocal', connected: false, icon: 'DL' },
  { id: 'chase', name: 'Chase', connected: false, icon: 'CH' },
  { id: 'airwallex', name: 'Airwallex', connected: false, icon: 'AW' },
]

export default function SettingsPage() {
  const [businessName, setBusinessName] = useState('My Business')
  const [supportEmail, setSupportEmail] = useState('support@mybusiness.com')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and payment processors</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-[#111] border border-white/10 p-1">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400"
          >
            <Building2 className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="processors"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Processors
          </TabsTrigger>
          <TabsTrigger
            value="routing"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400"
          >
            <Route className="h-4 w-4 mr-2" />
            Routing Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Business Information</h2>
              <p className="text-sm text-gray-500 mt-1">Basic information about your business</p>
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
              <Button className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
                Save Changes
              </Button>
            </div>
          </div>

          <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Environment</h2>
              <p className="text-sm text-gray-500 mt-1">Configure your test and production environments</p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-amber-400">T</span>
                  </div>
                  <div>
                    <p className="font-medium text-white">Test Mode</p>
                    <p className="text-sm text-gray-500">Currently active</p>
                  </div>
                </div>
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Active</Badge>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="processors" className="space-y-6">
          <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Payment Processors</h2>
              <p className="text-sm text-gray-500 mt-1">Configure your payment processor credentials</p>
            </div>
            <div className="p-6">
              <div className="grid gap-3">
                {PSP_LIST.map((psp) => (
                  <div
                    key={psp.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        psp.connected ? 'bg-[#19d1c3]/10' : 'bg-white/5'
                      }`}>
                        <span className={`text-sm font-bold ${
                          psp.connected ? 'text-[#19d1c3]' : 'text-gray-500'
                        }`}>
                          {psp.icon}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-white">{psp.name}</p>
                        <p className="text-sm text-gray-500">
                          {psp.connected ? 'Connected and ready' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {psp.connected ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-green-400">
                          <Check className="h-4 w-4" />
                          <span className="text-sm">Connected</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-gray-300 hover:bg-white/5"
                        >
                          Configure
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
                      >
                        Connect
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Routing Rules</h2>
              <p className="text-sm text-gray-500 mt-1">Configure how payments are routed to different processors</p>
            </div>
            <div className="p-12 text-center">
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <Route className="h-6 w-6 text-gray-500" />
                </div>
                <p className="text-gray-400 mb-2">No routing rules configured yet</p>
                <p className="text-sm text-gray-500 mb-4">Payments will be sent to the first available processor</p>
                <Button className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
                  Add Routing Rule
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Advanced Orchestration</h2>
              <p className="text-sm text-gray-500 mt-1">Configure advanced routing with weights and retry logic</p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-white/10">
                <div>
                  <p className="font-medium text-white">Orchestration Dashboard</p>
                  <p className="text-sm text-gray-500">Configure weighted routing, retry rules, and PSP health monitoring</p>
                </div>
                <Button
                  variant="outline"
                  className="border-white/10 text-gray-300 hover:bg-white/5"
                  onClick={() => window.location.href = '/dashboard/orchestration'}
                >
                  Open Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
