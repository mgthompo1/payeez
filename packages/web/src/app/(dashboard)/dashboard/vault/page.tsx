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

const CARD_BRAND_ICONS: Record<string, string> = {
  visa: '💳',
  mastercard: '💳',
  amex: '💳',
  discover: '💳',
  unknown: '💳',
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

    let query = supabase
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false })

    if (providerFilter !== 'all') {
      query = query.eq('vault_provider', providerFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading tokens:', error)
    } else {
      setTokens(data || [])
    }
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

  const activeTokens = filteredTokens.filter(t => t.is_active)
  const expiredTokens = filteredTokens.filter(t => !t.is_active)

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
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('tokens')
      .update({ is_active: false })
      .eq('id', tokenId)

    if (error) {
      console.error('Error revoking token:', error)
    } else {
      loadTokens()
      setSelectedToken(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vault</h1>
          <p className="text-gray-500 mt-1">Securely stored payment tokens</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={loadTokens}
          disabled={loading}
          className="border-white/10 text-gray-300 hover:bg-white/5"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-[#0f1621] border border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#19d1c3] to-[#c8ff5a] flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-[#8ba3b7]">Total Tokens</p>
              <p className="text-2xl font-bold text-white">{tokens.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-[#0f1621] border border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-[#8ba3b7]">Active</p>
              <p className="text-2xl font-bold text-white">{activeTokens.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-[#0f1621] border border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#19d1c3] to-[#4cc3ff] flex items-center justify-center">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-[#8ba3b7]">Atlas Vault</p>
              <p className="text-2xl font-bold text-white">
                {tokens.filter(t => t.vault_provider === 'atlas').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Encryption Info */}
      <div className="rounded-xl bg-gradient-to-br from-[#19d1c3]/10 to-[#c8ff5a]/10 border border-[#19d1c3]/20 p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-[#19d1c3] mt-0.5" />
        <div>
          <h3 className="font-medium text-white">PCI-DSS Compliant Storage</h3>
          <p className="text-sm text-gray-400 mt-1">
            Card data is encrypted with AES-256-GCM using per-tenant key derivation.
            Only tokenized references are stored - raw card numbers are never persisted.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search by email, card, or token ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-48 bg-[#0a0a0a] border-white/10 text-white">
            <SelectValue placeholder="All providers" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-white/10">
            <SelectItem value="all" className="text-white hover:bg-white/5">All Providers</SelectItem>
            <SelectItem value="atlas" className="text-white hover:bg-white/5">Atlas Vault</SelectItem>
            <SelectItem value="basis_theory" className="text-white hover:bg-white/5">Basis Theory</SelectItem>
            <SelectItem value="vgs" className="text-white hover:bg-white/5">VGS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tokens Table */}
      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Stored Tokens</h2>
          <p className="text-sm text-gray-500 mt-1">Click on a token to view details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Card</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="h-8 w-8 text-[#19d1c3] animate-spin mb-4" />
                      <p className="text-gray-400">Loading tokens...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                        <Shield className="h-6 w-6 text-gray-500" />
                      </div>
                      <p className="text-gray-400 mb-2">No tokens found</p>
                      <p className="text-sm text-gray-500">Tokens will appear here when payments are processed</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTokens.map((token) => {
                  const expiryStatus = getExpiryStatus(token)
                  return (
                    <tr
                      key={token.id}
                      onClick={() => setSelectedToken(token)}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6">
                        <code className="text-sm text-[#19d1c3] bg-[#19d1c3]/10 px-2 py-1 rounded">
                          {token.id.slice(0, 8)}...
                        </code>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-white capitalize">{token.card_brand || 'Unknown'}</span>
                          {token.card_last4 && (
                            <span className="text-gray-400">•••• {token.card_last4}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-gray-300">{token.customer_email || '—'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={
                          token.vault_provider === 'atlas'
                            ? 'bg-[#19d1c3]/10 text-[#19d1c3] border-[#19d1c3]/20'
                            : 'bg-white/5 text-gray-300 border-white/10'
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
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }>
                          {!token.is_active ? 'Revoked' : expiryStatus === 'expiring' ? 'Expiring Soon' : 'Active'}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-gray-500 text-sm">
                          {new Date(token.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            revokeToken(token.id)
                          }}
                          disabled={!token.is_active}
                          className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
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

      {/* Token Detail Sheet */}
      <Sheet open={!!selectedToken} onOpenChange={() => setSelectedToken(null)}>
        <SheetContent className="bg-[#111] border-white/10 w-[500px] overflow-y-auto">
          {selectedToken && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#19d1c3] to-[#c8ff5a] flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  Token Details
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status */}
                <div>
                  <Badge className={
                    !selectedToken.is_active
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-green-500/10 text-green-400 border-green-500/20'
                  }>
                    {selectedToken.is_active ? 'Active' : 'Revoked'}
                  </Badge>
                </div>

                {/* Token ID */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Token ID</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-black/50 rounded-lg px-3 py-2 text-sm text-[#19d1c3] font-mono truncate">
                      {selectedToken.id}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(selectedToken.id, 'id')}
                      className="text-gray-400 hover:text-white"
                    >
                      {copiedField === 'id' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Card Details */}
                <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <CreditCard className="h-4 w-4 text-[#19d1c3]" />
                    Card Details
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Brand</p>
                      <p className="text-white capitalize">{selectedToken.card_brand || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Last 4</p>
                      <p className="text-white font-mono">{selectedToken.card_last4 || '****'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Expiry</p>
                      <p className="text-white">
                        {selectedToken.card_exp_month && selectedToken.card_exp_year
                          ? `${String(selectedToken.card_exp_month).padStart(2, '0')}/${selectedToken.card_exp_year}`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Holder</p>
                      <p className="text-white">{selectedToken.card_holder_name || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Customer */}
                {selectedToken.customer_email && (
                  <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-white font-medium">
                      <User className="h-4 w-4 text-[#19d1c3]" />
                      Customer
                    </div>
                    <p className="text-gray-300">{selectedToken.customer_email}</p>
                  </div>
                )}

                {/* Vault Provider */}
                <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Lock className="h-4 w-4 text-[#19d1c3]" />
                    Encryption
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      selectedToken.vault_provider === 'atlas'
                        ? 'bg-[#19d1c3]/10 text-[#19d1c3] border-[#19d1c3]/20'
                        : 'bg-white/5 text-gray-300 border-white/10'
                    }>
                      {selectedToken.vault_provider}
                    </Badge>
                    {selectedToken.vault_provider === 'atlas' && (
                      <span className="text-xs text-gray-500">AES-256-GCM</span>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Clock className="h-4 w-4 text-[#19d1c3]" />
                    Timestamps
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Created</span>
                      <span className="text-gray-300">{formatDate(selectedToken.created_at)}</span>
                    </div>
                    {selectedToken.expires_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Expires</span>
                        <span className="text-gray-300">{formatDate(selectedToken.expires_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Session */}
                {selectedToken.session_id && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Session ID</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-black/50 rounded-lg px-3 py-2 text-sm text-gray-400 font-mono truncate">
                        {selectedToken.session_id}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(selectedToken.session_id!, 'session')}
                        className="text-gray-400 hover:text-white"
                      >
                        {copiedField === 'session' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {selectedToken.is_active && (
                  <Button
                    variant="outline"
                    onClick={() => revokeToken(selectedToken.id)}
                    className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Revoke Token
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
