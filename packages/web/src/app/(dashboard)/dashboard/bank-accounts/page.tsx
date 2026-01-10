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
import { Landmark, Plus, Search, Copy, Check, Building, ArrowUpRight, ArrowDownLeft, AlertTriangle, Loader2 } from 'lucide-react'
import { BankAccountForm } from '@/components/bank/BankAccountForm'
import { MicrodepositVerification } from '@/components/bank/MicrodepositVerification'

interface BankAccount {
  id: string
  customer_id: string | null
  holder_name: string
  account_type: 'checking' | 'savings'
  last4: string
  routing_last4: string
  bank_name: string | null
  country: string
  currency: string
  is_default: boolean
  is_active: boolean
  verification_status: 'unverified' | 'pending' | 'verified' | 'failed'
  verification_method: string | null
  nickname: string | null
  created_at: string
  verified_at: string | null
  microdeposit_expires_at: string | null
  verification_attempts: number
  customer?: {
    name: string | null
    email: string
  }
  transfers_count?: number
}

interface BankTransfer {
  id: string
  amount: number
  currency: string
  direction: 'debit' | 'credit'
  status: string
  description: string | null
  created_at: string
  settled_at: string | null
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const [accountTransfers, setAccountTransfers] = useState<BankTransfer[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [showVerification, setShowVerification] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    if (selectedAccount) {
      loadTransfers(selectedAccount.id)
    }
  }, [selectedAccount])

  const loadAccounts = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: accountsData, error } = await supabase
      .from('bank_accounts')
      .select(`
        *,
        customer:customers(name, email),
        transfers:bank_transfers(count)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!error && accountsData) {
      setAccounts(accountsData.map((a: any) => ({
        ...a,
        customer: a.customer,
        transfers_count: a.transfers?.[0]?.count || 0,
      })))
    }
    setLoading(false)
  }

  const loadTransfers = async (accountId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('bank_transfers')
      .select('*')
      .eq('bank_account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) setAccountTransfers(data)
  }

  const filteredAccounts = accounts.filter(account =>
    account.holder_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.bank_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.last4.includes(searchQuery) ||
    account.customer?.email?.toLowerCase().includes(searchQuery.toLowerCase())
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

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const getStatusBadge = (status: BankAccount['verification_status']) => {
    const config = {
      unverified: { label: 'Unverified', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      pending: { label: 'Pending', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      verified: { label: 'Verified', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
      failed: { label: 'Failed', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    }
    return config[status]
  }

  const handleCreateAccount = async (data: {
    routingNumber: string
    accountNumber: string
    accountType: 'checking' | 'savings'
    holderName: string
  }) => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('bank_accounts').insert({
      holder_name: data.holderName,
      account_type: data.accountType,
      last4: data.accountNumber.slice(-4),
      routing_last4: data.routingNumber.slice(-4),
      country: 'US',
      currency: 'USD',
      verification_status: 'unverified',
      is_active: true,
    })
    if (!error) {
      setIsCreateOpen(false)
      loadAccounts()
    }
    setSaving(false)
  }

  const handleVerify = async (amounts: [number, number]) => {
    if (!selectedAccount) return { verified: false, error: 'No account selected' }
    const supabase = createClient()
    const { data: account } = await supabase
      .from('bank_accounts')
      .select('microdeposit_amount_1, microdeposit_amount_2, verification_attempts')
      .eq('id', selectedAccount.id)
      .single()
    if (!account?.microdeposit_amount_1 || !account?.microdeposit_amount_2) {
      return { verified: false, error: 'Micro-deposits not initiated' }
    }
    const correctAmounts = [account.microdeposit_amount_1, account.microdeposit_amount_2].sort((a, b) => a - b)
    const userAmounts = [...amounts].sort((a, b) => a - b)
    const isCorrect = correctAmounts[0] === userAmounts[0] && correctAmounts[1] === userAmounts[1]
    if (isCorrect) {
      await supabase.from('bank_accounts').update({ verification_status: 'verified', verified_at: new Date().toISOString() }).eq('id', selectedAccount.id)
      loadAccounts(); setShowVerification(false); setSelectedAccount(null); return { verified: true }
    } else {
      const attempts = (account.verification_attempts || 0) + 1
      await supabase.from('bank_accounts').update({ verification_attempts: attempts }).eq('id', selectedAccount.id)
      return { verified: false, error: 'Incorrect amounts', attemptsRemaining: 3 - attempts }
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Bank Accounts</h1>
          <p className="text-slate-500 mt-1">Manage institutional funding sources for A2A and ACH transfers.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-medium h-10 px-6 rounded-full shadow-lg shadow-cyan-500/20">
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-charcoal border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Bank Account</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <BankAccountForm onSubmit={handleCreateAccount} loading={saving} submitLabel="Add Account" />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Accounts', value: accounts.length, color: 'text-white' },
          { label: 'Verified', value: accounts.filter(a => a.verification_status === 'verified').length, color: 'text-cyan-400' },
          { label: 'Pending', value: accounts.filter(a => a.verification_status === 'pending').length, color: 'text-blue-400' },
          { label: 'Unverified', value: accounts.filter(a => a.verification_status === 'unverified').length, color: 'text-amber-400' },
        ].map((stat, i) => (
          <div key={i} className="dashboard-card p-5">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="dashboard-card p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search by holder name, bank, or account number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-obsidian border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400"
          />
        </div>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Bank Registry</h2>
          <p className="text-sm text-slate-500">{filteredAccounts.length} accounts connected</p>
        </div>

        {loading ? (
          <div className="p-12 text-center"><Loader2 className="h-8 w-8 text-cyan-400 animate-spin mx-auto" /></div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-20 text-center">
            <Landmark className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No accounts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-slate-500">Account</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-slate-500">Holder</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-slate-500">Status</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-slate-500">Transfers</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase tracking-widest font-bold text-slate-500">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAccounts.map((account) => {
                  const status = getStatusBadge(account.verification_status)
                  return (
                    <tr key={account.id} onClick={() => setSelectedAccount(account)} className="hover:bg-white/5 transition-colors cursor-pointer group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-sm">
                            <Building className="h-5 w-5 text-cyan-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium group-hover:text-cyan-400 transition-colors">{account.bank_name || account.nickname || 'Bank Account'}</span>
                              {account.is_default && <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[9px] uppercase font-bold">Default</Badge>}
                            </div>
                            <p className="text-xs text-slate-500">{account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} ••••{account.last4}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-slate-300 font-medium">{account.holder_name}</span>
                        {account.customer && <p className="text-xs text-slate-500">{account.customer.email}</p>}
                      </td>
                      <td className="py-4 px-6"><Badge className={`${status.className} rounded-full font-bold text-[10px] uppercase`}>{status.label}</Badge></td>
                      <td className="py-4 px-6 text-slate-400 font-mono text-sm">{account.transfers_count || 0}</td>
                      <td className="py-4 px-6 text-slate-500 text-sm">{formatDate(account.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={!!selectedAccount && !showVerification} onOpenChange={() => setSelectedAccount(null)}>
        <SheetContent className="bg-charcoal border-white/10 w-[500px] overflow-y-auto text-slate-300">
          <SheetHeader><SheetTitle className="text-white">Account Details</SheetTitle></SheetHeader>
          {selectedAccount && (
            <div className="mt-8 space-y-6">
              <div className="dashboard-card bg-white/5 p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Building className="h-7 w-7 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{selectedAccount.bank_name || 'Bank Account'}</h3>
                    <p className="text-slate-500">{selectedAccount.account_type.charAt(0).toUpperCase() + selectedAccount.account_type.slice(1)} ••••{selectedAccount.last4}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div><p className="text-[10px] uppercase font-bold text-slate-500">Routing</p><p className="text-white font-mono">•••••{selectedAccount.routing_last4}</p></div>
                  <div><p className="text-[10px] uppercase font-bold text-slate-500">Holder</p><p className="text-white truncate">{selectedAccount.holder_name}</p></div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verification</h3>
                <div className="dashboard-card bg-black/20 p-4 flex items-center justify-between">
                  <Badge className={getStatusBadge(selectedAccount.verification_status).className}>{getStatusBadge(selectedAccount.verification_status).label}</Badge>
                  {(selectedAccount.verification_status === 'unverified' || selectedAccount.verification_status === 'pending') && (
                    <Button variant="outline" size="sm" onClick={() => setShowVerification(true)} className="border-white/10 text-slate-300 hover:bg-white/5 rounded-full h-8 px-4">Verify Now</Button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Account ID</h3>
                <div className="flex items-center gap-2 p-1 bg-obsidian rounded-xl border border-white/5">
                  <code className="flex-1 px-3 py-2 text-sm text-cyan-400 font-mono truncate">{selectedAccount.id}</code>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(selectedAccount.id, 'id')} className="text-slate-400 hover:text-white rounded-full"><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}