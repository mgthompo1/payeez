'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Users, Plus, Search, Mail, Phone, MapPin, CreditCard, FileText, Copy, Check } from 'lucide-react'

interface Customer {
  id: string
  email: string
  name: string | null
  phone: string | null
  description: string | null
  billing_address: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  } | null
  tax_exempt: boolean
  metadata: Record<string, string>
  created_at: string
  subscriptions_count?: number
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    description: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: customersData, error } = await supabase
      .from('customers')
      .select(`
        *,
        subscriptions:subscriptions(count)
      `)
      .order('created_at', { ascending: false })

    if (!error && customersData) {
      setCustomers(customersData.map((c: any) => ({
        ...c,
        subscriptions_count: c.subscriptions?.[0]?.count || 0,
      })))
    }

    setLoading(false)
  }

  const filteredCustomers = customers.filter(customer =>
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery)
  )

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatAddress = (address: Customer['billing_address']) => {
    if (!address) return null
    const parts = [
      address.line1,
      address.line2,
      [address.city, address.state, address.postal_code].filter(Boolean).join(' '),
      address.country,
    ].filter(Boolean)
    return parts.join(', ')
  }

  const createCustomer = async () => {
    if (!formData.email.trim()) return

    setSaving(true)
    const supabase = createClient()

    const billingAddress = formData.line1 ? {
      line1: formData.line1 || undefined,
      line2: formData.line2 || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      postal_code: formData.postal_code || undefined,
      country: formData.country || undefined,
    } : null

    const { error } = await supabase.from('customers').insert({
      email: formData.email,
      name: formData.name || null,
      phone: formData.phone || null,
      description: formData.description || null,
      billing_address: billingAddress,
    })

    if (!error) {
      setFormData({
        email: '',
        name: '',
        phone: '',
        description: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
      })
      setIsCreateOpen(false)
      loadCustomers()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-gray-500 mt-1">Manage your customer accounts</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="customer@example.com"
                    className="bg-[#0a0a0a] border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    className="bg-[#0a0a0a] border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 555 123 4567"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Internal notes..."
                  className="bg-[#0a0a0a] border-white/10 text-white min-h-[80px]"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-gray-400">Billing Address</Label>
                <Input
                  value={formData.line1}
                  onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
                  placeholder="Address line 1"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
                <Input
                  value={formData.line2}
                  onChange={(e) => setFormData({ ...formData, line2: e.target.value })}
                  placeholder="Address line 2"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                    className="bg-[#0a0a0a] border-white/10 text-white"
                  />
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                    className="bg-[#0a0a0a] border-white/10 text-white"
                  />
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="Postal code"
                    className="bg-[#0a0a0a] border-white/10 text-white"
                  />
                </div>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Country"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <Button
                onClick={createCustomer}
                disabled={saving || !formData.email.trim()}
                className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90"
              >
                {saving ? 'Creating...' : 'Create Customer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            placeholder="Search by email, name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Customers List */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">All Customers</h2>
          <p className="text-sm text-gray-500">{filteredCustomers.length} customers</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-500 border-r-transparent"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-gray-500" />
              </div>
              <p className="text-gray-400 mb-2">No customers yet</p>
              <p className="text-sm text-gray-500">Add your first customer to get started</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Subscriptions</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                          <span className="text-violet-400 font-medium">
                            {(customer.name || customer.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-white font-medium">
                            {customer.name || 'Unnamed'}
                          </span>
                          {customer.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                              {customer.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-400">{customer.email}</span>
                    </td>
                    <td className="py-4 px-6">
                      {customer.subscriptions_count && customer.subscriptions_count > 0 ? (
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                          {customer.subscriptions_count} active
                        </Badge>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-500 text-sm">{formatDate(customer.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <SheetContent className="bg-[#111] border-white/10 w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white">Customer Details</SheetTitle>
          </SheetHeader>

          {selectedCustomer && (
            <div className="mt-6 space-y-6">
              {/* Customer Info */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                    <span className="text-violet-400 font-medium text-xl">
                      {(selectedCustomer.name || selectedCustomer.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">
                      {selectedCustomer.name || 'Unnamed Customer'}
                    </h3>
                    <p className="text-gray-500">Customer since {formatDate(selectedCustomer.created_at)}</p>
                  </div>
                </div>
                {selectedCustomer.description && (
                  <p className="text-gray-400 text-sm">{selectedCustomer.description}</p>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span className="text-white">{selectedCustomer.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(selectedCustomer.email, 'email')}
                      className="h-8 w-8 text-gray-400 hover:text-white"
                    >
                      {copied === 'email' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-white">{selectedCustomer.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ID */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Identifier</h3>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <div className="text-xs text-gray-500">Customer ID</div>
                    <code className="text-sm text-[#19d1c3]">{selectedCustomer.id}</code>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(selectedCustomer.id, 'id')}
                    className="h-8 w-8 text-gray-400 hover:text-white"
                  >
                    {copied === 'id' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Billing Address */}
              {selectedCustomer.billing_address && formatAddress(selectedCustomer.billing_address) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Billing Address</h3>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                    <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                    <span className="text-white">{formatAddress(selectedCustomer.billing_address)}</span>
                  </div>
                </div>
              )}

              {/* Tax Status */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Status</h3>
                <div className="p-3 rounded-lg bg-white/5">
                  <Badge className={selectedCustomer.tax_exempt
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                  }>
                    {selectedCustomer.tax_exempt ? 'Tax Exempt' : 'Taxable'}
                  </Badge>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Payment Methods
                  </Button>
                  <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
                    <FileText className="h-4 w-4 mr-2" />
                    Invoices
                  </Button>
                </div>
              </div>

              {/* Metadata */}
              {selectedCustomer.metadata && Object.keys(selectedCustomer.metadata).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</h3>
                  <div className="p-3 rounded-lg bg-white/5">
                    <pre className="text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(selectedCustomer.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
