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
import { Package, Plus, Search, Edit, ChevronDown, ChevronRight, DollarSign, Loader2 } from 'lucide-react'

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

  const [formData, setFormData] = useState({ name: '', description: '', is_active: true })
  const [priceFormData, setPriceFormData] = useState({ currency: 'usd', unit_amount: '', type: 'recurring' as 'one_time' | 'recurring', interval: 'month' as any, interval_count: '1', nickname: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: productsData, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (!error && productsData) {
      const productIds = productsData.map(p => p.id)
      const { data: pricesData } = await supabase.from('prices').select('*').in('product_id', productIds).order('created_at', { ascending: false })
      const pricesByProduct: Record<string, Price[]> = {}
      ;(pricesData || []).forEach((price: Price) => {
        if (!pricesByProduct[price.product_id]) pricesByProduct[price.product_id] = []
        pricesByProduct[price.product_id].push(price)
      })
      setProducts(productsData.map(p => ({ ...p, prices: pricesByProduct[p.id] || [] })))
    }
    setLoading(false)
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleExpanded = (productId: string) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(productId)) newExpanded.delete(productId)
    else newExpanded.add(productId)
    setExpandedProducts(newExpanded)
  }

  const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100)
  const formatInterval = (interval: string | null, count: number | null) => interval ? `every ${count && count > 1 ? count : ''} ${interval}${count && count > 1 ? 's' : ''}` : ''

  const createProduct = async () => {
    if (!formData.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('products').insert({ name: formData.name, description: formData.description || null, is_active: formData.is_active })
    if (!error) { setFormData({ name: '', description: '', is_active: true }); setIsCreateOpen(false); loadProducts() }
    setSaving(false)
  }

  const createPrice = async () => {
    if (!selectedProductId || !priceFormData.unit_amount) return
    setSaving(true)
    const supabase = createClient()
    const insertData: any = { product_id: selectedProductId, currency: priceFormData.currency.toLowerCase(), unit_amount: Math.round(parseFloat(priceFormData.unit_amount) * 100), type: priceFormData.type, billing_scheme: 'per_unit', is_active: true, nickname: priceFormData.nickname || null }
    if (priceFormData.type === 'recurring') { insertData.recurring_interval = priceFormData.interval; insertData.recurring_interval_count = parseInt(priceFormData.interval_count) || 1; insertData.recurring_usage_type = 'licensed' }
    const { error } = await supabase.from('prices').insert(insertData)
    if (!error) { setPriceFormData({ currency: 'usd', unit_amount: '', type: 'recurring', interval: 'month', interval_count: '1', nickname: '' }); setIsCreatePriceOpen(false); setSelectedProductId(null); loadProducts() }
    setSaving(false)
  }

  const toggleProductActive = async (product: Product) => {
    const supabase = createClient()
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    loadProducts()
  }

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Products</h1>
          <p className="text-slate-500 mt-1">Manage catalog and pricing strategy.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-medium h-10 px-6 rounded-full shadow-lg shadow-cyan-500/20">
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-charcoal border-white/10 text-white">
            <DialogHeader><DialogTitle>Create Product</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Enterprise Tier" className="bg-obsidian border-white/10 text-white focus:border-cyan-400" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-300">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Visual identifiers for your product..." className="bg-obsidian border-white/10 text-white min-h-[100px] focus:border-cyan-400" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <Label htmlFor="active" className="text-slate-300">Published</Label>
                <Switch id="active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              </div>
              <Button onClick={createProduct} disabled={saving || !formData.name.trim()} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-11 rounded-full">{saving ? 'Processing...' : 'Deploy Product'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="dashboard-card p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search catalog..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-obsidian border-white/10 text-white focus:border-cyan-400" />
        </div>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
          <h2 className="text-lg font-semibold text-white">Product Catalog</h2>
          <Badge variant="outline" className="bg-white/5 text-slate-400 border-white/10 font-mono text-[10px]">{filteredProducts.length} TOTAL</Badge>
        </div>

        {loading ? (
          <div className="p-16 text-center"><Loader2 className="h-8 w-8 text-cyan-400 animate-spin mx-auto" /></div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center">
            <Package className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500">Inventory is empty.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredProducts.map((product) => (
              <div key={product.id} className="group">
                <div className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-all cursor-pointer" onClick={() => toggleExpanded(product.id)}>
                  <div className="flex items-center gap-5">
                    <div className={`transition-transform duration-300 ${expandedProducts.has(product.id) ? 'rotate-180' : ''}`}><ChevronDown className="h-4 w-4 text-slate-600" /></div>
                    <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                      <Package className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-bold text-lg group-hover:text-cyan-400 transition-colors">{product.name}</span>
                        {!product.is_active && <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20 font-bold text-[9px] uppercase tracking-tighter">Draft</Badge>}
                      </div>
                      {product.description && <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{product.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Pricing</p>
                      <p className="text-sm text-slate-300 font-mono">{product.prices?.length || 0} variants</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleProductActive(product) }} className="text-slate-500 hover:text-cyan-400 rounded-full h-10 w-10"><Edit className="h-4 w-4" /></Button>
                  </div>
                </div>

                {expandedProducts.has(product.id) && (
                  <div className="bg-obsidian/40 border-t border-white/5 p-6 pl-24 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500">Price Configurations</h3>
                      <Button variant="outline" size="sm" className="border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 rounded-full h-8" onClick={(e) => { e.stopPropagation(); setSelectedProductId(product.id); setIsCreatePriceOpen(true) }}>
                        <Plus className="h-3 w-3 mr-1.5" />New Price
                      </Button>
                    </div>
                    <div className="grid gap-3">
                      {product.prices && product.prices.length > 0 ? (
                        product.prices.map((price) => (
                          <div key={price.id} className="dashboard-card bg-white/[0.02] p-4 flex items-center justify-between border-white/5 hover:border-cyan-500/20 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><DollarSign className="h-5 w-5 text-emerald-400" /></div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-bold">{price.unit_amount !== null ? formatAmount(price.unit_amount, price.currency) : 'Metered'}</span>
                                  <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">{formatInterval(price.recurring_interval, price.recurring_interval_count)}</span>
                                </div>
                                {price.nickname && <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">{price.nickname}</p>}
                              </div>
                            </div>
                            <code className="text-[10px] text-slate-600 font-mono">ID: {price.id.slice(0, 12)}...</code>
                          </div>
                        ))
                      ) : <p className="text-xs text-slate-600 italic text-center py-4">No active prices defined.</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreatePriceOpen} onOpenChange={(open) => { setIsCreatePriceOpen(open); if (!open) setSelectedProductId(null) }}>
        <DialogContent className="bg-charcoal border-white/10 text-white">
          <DialogHeader><DialogTitle>Add Price Configuration</DialogTitle></DialogHeader>
          <div className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Billing Logic</Label>
              <select value={priceFormData.type} onChange={(e) => setPriceFormData({ ...priceFormData, type: e.target.value as any })} className="h-10 w-full rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none">
                <option value="recurring">Subscription (Recurring)</option>
                <option value="one_time">One-off Purchase</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Unit Cost</Label>
                <Input type="number" step="0.01" min="0" value={priceFormData.unit_amount} onChange={(e) => setPriceFormData({ ...priceFormData, unit_amount: e.target.value })} placeholder="0.00" className="bg-obsidian border-white/10 text-white focus:border-cyan-400 h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Currency</Label>
                <select value={priceFormData.currency} onChange={(e) => setPriceFormData({ ...priceFormData, currency: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none">
                  <option value="usd">USD</option><option value="eur">EUR</option><option value="gbp">GBP</option><option value="nzd">NZD</option>
                </select>
              </div>
            </div>
            {priceFormData.type === 'recurring' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Interval</Label>
                  <select value={priceFormData.interval} onChange={(e) => setPriceFormData({ ...priceFormData, interval: e.target.value as any })} className="h-10 w-full rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none">
                    <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Count</Label>
                  <Input type="number" min="1" value={priceFormData.interval_count} onChange={(e) => setPriceFormData({ ...priceFormData, interval_count: e.target.value })} className="bg-obsidian border-white/10 text-white focus:border-cyan-400 h-10" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-slate-300">Internal Reference</Label>
              <Input value={priceFormData.nickname} onChange={(e) => setPriceFormData({ ...priceFormData, nickname: e.target.value })} placeholder="e.g., Annual Pro Discount" className="bg-obsidian border-white/10 text-white focus:border-cyan-400 h-10" />
            </div>
            <Button onClick={createPrice} disabled={saving || !priceFormData.unit_amount} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-11 rounded-full shadow-lg shadow-cyan-500/20 transition-all">{saving ? 'Creating...' : 'Finalize Price'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}