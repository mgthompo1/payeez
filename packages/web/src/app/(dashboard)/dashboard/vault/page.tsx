'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Shield, CreditCard, Trash2, Search, RefreshCw, Loader2, Copy, Check, Lock, Clock, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Token {
  id: string
  customer_email: string | null
  vault_provider: string
  card_brand: string | null
  card_last4: string | null
  card_exp_month: number | null
  card_exp_year: number | null
  card_holder_name: string | null
  is_active: boolean
  created_at: string
  expires_at: string | null
  session_id: string | null
}

export default function VaultPage() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const loadTokens = async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('tokens').select('*').order('created_at', { ascending: false })
    if (providerFilter !== 'all') query = query.eq('vault_provider', providerFilter)
    const { data, error } = await query
    if (error) console.error('Error loading tokens:', error)
    else setTokens(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadTokens()
  }, [providerFilter])

  const filteredTokens = tokens.filter(token => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      token.customer_email?.toLowerCase().includes(search) ||
      token.card_last4?.includes(search) ||
      token.card_holder_name?.toLowerCase().includes(search) ||
      token.id.toLowerCase().includes(search)
    )
  })

  const activeTokens = tokens.filter(t => t.is_active)

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getExpiryStatus = (token: Token) => {
    if (!token.expires_at) return null
    const now = new Date()
    const expiry = new Date(token.expires_at)
    if (expiry < now) return 'expired'
    const hourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
    if (expiry < hourFromNow) return 'expiring'
    return 'valid'
  }

  const revokeToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token?')) return
    const supabase = createClient()
    const { error } = await supabase.from('tokens').update({ is_active: false }).eq('id', tokenId)
    if (!error) {
      loadTokens()
      setSelectedToken(null)
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Vault</h1>
          <p className="text-slate-500 mt-1">Securely stored payment tokens and PCI-compliant data</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={loadTokens}
          disabled={loading}
          className="border-white/10 text-slate-300 hover:bg-white/5 h-10 w-10"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Total Tokens', value: tokens.length, icon: Shield, color: 'from-cyan-500 to-blue-600' },
          { label: 'Active Tokens', value: activeTokens.length, icon: CreditCard, color: 'from-emerald-500 to-teal-600' },
          { label: 'Atlas Managed', value: tokens.filter(t => t.vault_provider === 'atlas').length, icon: Lock, color: 'from-blue-500 to-cyan-600' },
        ].map((stat, i) => (
          <div key={i} className="dashboard-card p-6 flex items-center gap-5">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg shadow-black/20`}>
              <stat.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Encryption Info */}
      <div className="dashboard-card bg-cyan-500/5 border-cyan-500/20 p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-cyan-400 mt-0.5" />
        <div>
          <h3 className="font-medium text-white">PCI-DSS Compliant Infrastructure</h3>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Sensitive data is encrypted with AES-256-GCM. Atlas implements per-tenant key derivation and rigorous audit logging. 
            Raw card numbers are tokenized at the edge and never touch your server.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by email, last 4, or token ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-obsidian border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400"
          />
        </div>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-56 bg-obsidian border-white/10 text-white focus:border-cyan-400">
            <SelectValue placeholder="All providers" />
          </SelectTrigger>
          <SelectContent className="bg-charcoal border-white/10">
            <SelectItem value="all" className="text-white hover:bg-white/5">All Providers</SelectItem>
            <SelectItem value="atlas" className="text-white hover:bg-white/5">Atlas Vault</SelectItem>
            <SelectItem value="basis_theory" className="text-white hover:bg-white/5">Basis Theory</SelectItem>
            <SelectItem value="vgs" className="text-white hover:bg-white/5">VGS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tokens Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Security Tokens</h2>
            <p className="text-sm text-slate-500 mt-1">Active cryptographic references in the vault</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Token Reference</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Card Instrument</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                <th className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Shield className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 mb-1">No tokens found</p>
                    <p className="text-xs text-slate-600">Tokens will appear here when card data is captured</p>
                  </td>
                </tr>
              ) : (
                filteredTokens.map((token) => {
                  const expiryStatus = getExpiryStatus(token)
                  return (
                    <tr
                      key={token.id}
                      onClick={() => setSelectedToken(token)}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-6">
                        <code className="text-sm text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded font-mono group-hover:bg-cyan-400/20 transition-colors">
                          {token.id.slice(0, 12)}...
                        </code>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium capitalize">{token.card_brand || 'Card'}</span>
                          {token.card_last4 && (
                            <span className="text-slate-500 font-mono">•••• {token.card_last4}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-slate-300">{token.customer_email || '—'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={
                          token.vault_provider === 'atlas'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                            : 'bg-white/5 text-slate-400 border-white/10'
                        }>
                          {token.vault_provider}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={
                          !token.is_active
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : expiryStatus === 'expiring'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }>
                          {!token.is_active ? 'Revoked' : expiryStatus === 'expiring' ? 'Expiring' : 'Active'}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-slate-500 text-sm">
                          {new Date(token.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            revokeToken(token.id)
                          }}
                          disabled={!token.is_active}
                          className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!selectedToken} onOpenChange={() => setSelectedToken(null)}>
        <SheetContent className="bg-charcoal border-white/10 w-[500px] overflow-y-auto text-slate-300">
          {selectedToken && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  Token Intelligence
                </SheetTitle>
              </SheetHeader>

              <div className="mt-8 space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <Badge className={!selectedToken.is_active ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}>
                    {selectedToken.is_active ? 'Active' : 'Revoked'}
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">ID: {selectedToken.id.slice(0, 12)}</span>
                </div>

                <div className="space-y-3">
                  <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Token Reference</label>
                  <div className="flex items-center gap-2 p-1 bg-obsidian rounded-xl border border-white/5">
                    <code className="flex-1 px-3 py-2 text-sm text-cyan-400 font-mono truncate">
                      {selectedToken.id}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(selectedToken.id, 'id')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedField === 'id' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="dashboard-card bg-black/40 p-5 space-y-5">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm uppercase tracking-wider">
                    <CreditCard className="h-4 w-4 text-cyan-400" />
                    Payment Instrument
                  </div>
                  <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Brand</p>
                      <p className="text-white capitalize font-medium">{selectedToken.card_brand || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Account</p>
                      <p className="text-white font-mono font-medium">•••• {selectedToken.card_last4 || '****'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Expiry</p>
                      <p className="text-white font-medium">
                        {selectedToken.card_exp_month && selectedToken.card_exp_year
                          ? `${String(selectedToken.card_exp_month).padStart(2, '0')}/${selectedToken.card_exp_year}`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Cardholder</p>
                      <p className="text-white font-medium truncate">{selectedToken.card_holder_name || '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="dashboard-card bg-black/40 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm uppercase tracking-wider">
                    <Lock className="h-4 w-4 text-cyan-400" />
                    Vault Sovereignty
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className={
                      selectedToken.vault_provider === 'atlas'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        : 'bg-white/5 text-slate-400 border-white/10'
                    }>
                      {selectedToken.vault_provider}
                    </Badge>
                    <span className="text-xs text-slate-500 font-mono">AES-256-GCM / AAD</span>
                  </div>
                </div>

                <div className="dashboard-card bg-black/40 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm uppercase tracking-wider">
                    <Clock className="h-4 w-4 text-cyan-400" />
                    Timeline
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Vaulted at</span>
                      <span className="text-slate-200 font-medium">{formatDate(selectedToken.created_at)}</span>
                    </div>
                    {selectedToken.expires_at && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Auto-expiry</span>
                        <span className="text-slate-200 font-medium">{formatDate(selectedToken.expires_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedToken.is_active && (
                  <Button
                    variant="outline"
                    onClick={() => revokeToken(selectedToken.id)}
                    className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-full h-11 transition-all mt-4"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Revoke Stored Instrument
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}