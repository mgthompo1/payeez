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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Package, Plus, Search, Edit, ChevronDown, ChevronRight, DollarSign } from 'lucide-react'

interface Price {
  id: string
  product_id: string
  type: 'one_time' | 'recurring'
  billing_scheme: 'per_unit' | 'tiered'
  currency: string
  unit_amount: number | null
  recurring_interval: string | null
  recurring_interval_count: number | null
  recurring_usage_type: string | null
  is_active: boolean
  nickname: string | null
  created_at: string
}

interface Product {
  id: string
  name: string
  description: string | null
  is_active: boolean
  images: string[]
  metadata: Record<string, string>
  created_at: string
  prices?: Price[]
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreatePriceOpen, setIsCreatePriceOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  })

  const [priceFormData, setPriceFormData] = useState({
    currency: 'usd',
    unit_amount: '',
    type: 'recurring' as 'one_time' | 'recurring',
    interval: 'month' as 'day' | 'week' | 'month' | 'year',
    interval_count: '1',
    nickname: '',
  })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: productsData, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && productsData) {
      // Load prices for all products
      const productIds = productsData.map(p => p.id)
      const { data: pricesData } = await supabase
        .from('prices')
        .select('*')
        .in('product_id', productIds)
        .order('created_at', { ascending: false })

      const pricesByProduct: Record<string, Price[]> = {}
      ;(pricesData || []).forEach((price: Price) => {
        if (!pricesByProduct[price.product_id]) {
          pricesByProduct[price.product_id] = []
        }
        pricesByProduct[price.product_id].push(price)
      })

      setProducts(productsData.map(p => ({
        ...p,
        prices: pricesByProduct[p.id] || [],
      })))
    }

    setLoading(false)
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleExpanded = (productId: string) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId)
    } else {
      newExpanded.add(productId)
    }
    setExpandedProducts(newExpanded)
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const formatInterval = (interval: string | null, count: number | null) => {
    if (!interval) return ''
    const countStr = count && count > 1 ? count.toString() : ''
    return `every ${countStr} ${interval}${count && count > 1 ? 's' : ''}`
  }

  const createProduct = async () => {
    if (!formData.name.trim()) return

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase.from('products').insert({
      name: formData.name,
      description: formData.description || null,
      is_active: formData.is_active,
    })

    if (!error) {
      setFormData({ name: '', description: '', is_active: true })
      setIsCreateOpen(false)
      loadProducts()
    }
    setSaving(false)
  }

  const createPrice = async () => {
    if (!selectedProductId || !priceFormData.unit_amount) return

    setSaving(true)
    const supabase = createClient()

    const insertData: any = {
      product_id: selectedProductId,
      currency: priceFormData.currency.toLowerCase(),
      unit_amount: Math.round(parseFloat(priceFormData.unit_amount) * 100),
      type: priceFormData.type,
      billing_scheme: 'per_unit',
      is_active: true,
      nickname: priceFormData.nickname || null,
    }

    if (priceFormData.type === 'recurring') {
      insertData.recurring_interval = priceFormData.interval
      insertData.recurring_interval_count = parseInt(priceFormData.interval_count) || 1
      insertData.recurring_usage_type = 'licensed'
    }

    const { error } = await supabase.from('prices').insert(insertData)

    if (!error) {
      setPriceFormData({
        currency: 'usd',
        unit_amount: '',
        type: 'recurring',
        interval: 'month',
        interval_count: '1',
        nickname: '',
      })
      setIsCreatePriceOpen(false)
      setSelectedProductId(null)
      loadProducts()
    }
    setSaving(false)
  }

  const toggleProductActive = async (product: Product) => {
    const supabase = createClient()
    await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id)
    loadProducts()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-gray-500 mt-1">Manage your products and pricing</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Create Product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Pro Plan"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your product..."
                  className="bg-[#0a0a0a] border-white/10 text-white min-h-[100px]"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Active</Label>
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <Button
                onClick={createProduct}
                disabled={saving || !formData.name.trim()}
                className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90"
              >
                {saving ? 'Creating...' : 'Create Product'}
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
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Products List */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">All Products</h2>
          <p className="text-sm text-gray-500">{filteredProducts.length} products</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-500 border-r-transparent"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                <Package className="h-6 w-6 text-gray-500" />
              </div>
              <p className="text-gray-400 mb-2">No products yet</p>
              <p className="text-sm text-gray-500">Create your first product to get started</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredProducts.map((product) => (
              <div key={product.id}>
                {/* Product Row */}
                <div
                  className="flex items-center justify-between p-6 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => toggleExpanded(product.id)}
                >
                  <div className="flex items-center gap-4">
                    <button className="text-gray-500 hover:text-white">
                      {expandedProducts.has(product.id) ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </button>
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                      <Package className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{product.name}</span>
                        {!product.is_active && (
                          <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{product.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {product.prices?.length || 0} price{product.prices?.length !== 1 ? 's' : ''}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleProductActive(product)
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Prices */}
                {expandedProducts.has(product.id) && (
                  <div className="bg-[#0a0a0a] border-t border-white/5">
                    <div className="p-4 pl-16 space-y-2">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-400">Prices</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-gray-300 hover:bg-white/5"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedProductId(product.id)
                            setIsCreatePriceOpen(true)
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Price
                        </Button>
                      </div>

                      {product.prices && product.prices.length > 0 ? (
                        <div className="space-y-2">
                          {product.prices.map((price) => (
                            <div
                              key={price.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                  <DollarSign className="h-4 w-4 text-green-400" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">
                                      {price.unit_amount !== null
                                        ? formatAmount(price.unit_amount, price.currency)
                                        : 'Usage-based'}
                                    </span>
                                    {price.type === 'recurring' && (
                                      <span className="text-gray-500">
                                        {formatInterval(price.recurring_interval, price.recurring_interval_count)}
                                      </span>
                                    )}
                                    {price.type === 'one_time' && (
                                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                                        One-time
                                      </Badge>
                                    )}
                                    {!price.is_active && (
                                      <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">
                                        Inactive
                                      </Badge>
                                    )}
                                  </div>
                                  {price.nickname && (
                                    <p className="text-xs text-gray-500">{price.nickname}</p>
                                  )}
                                </div>
                              </div>
                              <code className="text-xs text-gray-500">{price.id.slice(0, 8)}...</code>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 py-4 text-center">
                          No prices configured. Add a price to enable billing.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Price Dialog */}
      <Dialog open={isCreatePriceOpen} onOpenChange={(open) => {
        setIsCreatePriceOpen(open)
        if (!open) setSelectedProductId(null)
      }}>
        <DialogContent className="bg-[#111] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Add Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="price-type">Price Type</Label>
              <select
                id="price-type"
                value={priceFormData.type}
                onChange={(e) => setPriceFormData({ ...priceFormData, type: e.target.value as 'one_time' | 'recurring' })}
                className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white"
              >
                <option value="recurring">Recurring</option>
                <option value="one_time">One-time</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceFormData.unit_amount}
                  onChange={(e) => setPriceFormData({ ...priceFormData, unit_amount: e.target.value })}
                  placeholder="0.00"
                  className="bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={priceFormData.currency}
                  onChange={(e) => setPriceFormData({ ...priceFormData, currency: e.target.value })}
                  className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white"
                >
                  <option value="usd">USD</option>
                  <option value="eur">EUR</option>
                  <option value="gbp">GBP</option>
                  <option value="aud">AUD</option>
                  <option value="nzd">NZD</option>
                </select>
              </div>
            </div>

            {priceFormData.type === 'recurring' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="interval">Billing Interval</Label>
                  <select
                    id="interval"
                    value={priceFormData.interval}
                    onChange={(e) => setPriceFormData({ ...priceFormData, interval: e.target.value as any })}
                    className="h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 text-sm text-white"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval-count">Interval Count</Label>
                  <Input
                    id="interval-count"
                    type="number"
                    min="1"
                    value={priceFormData.interval_count}
                    onChange={(e) => setPriceFormData({ ...priceFormData, interval_count: e.target.value })}
                    className="bg-[#0a0a0a] border-white/10 text-white"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname (optional)</Label>
              <Input
                id="nickname"
                value={priceFormData.nickname}
                onChange={(e) => setPriceFormData({ ...priceFormData, nickname: e.target.value })}
                placeholder="e.g., Monthly Pro"
                className="bg-[#0a0a0a] border-white/10 text-white"
              />
            </div>

            <Button
              onClick={createPrice}
              disabled={saving || !priceFormData.unit_amount}
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90"
            >
              {saving ? 'Creating...' : 'Create Price'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
