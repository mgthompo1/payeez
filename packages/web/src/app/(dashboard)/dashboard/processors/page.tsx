'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  RefreshCw,
  CreditCard,
  Shield,
  Zap,
  AlertTriangle,
  Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createPspCredential } from './actions'

type PSPName = 'stripe' | 'adyen' | 'authorizenet' | 'chase' | 'nuvei' | 'dlocal' | 'braintree' | 'checkoutcom' | 'airwallex' | 'windcave'

const PSP_LOGOS: Record<PSPName, string> = {
  stripe: '/logos/stripe.svg',
  adyen: '/logos/adyen.svg',
  braintree: '/logos/braintree.svg',
  nuvei: '/logos/nuvei.svg',
  dlocal: '/logos/dlocal.svg',
  airwallex: '/logos/airwallex.svg',
  authorizenet: '/logos/authorizenet.svg',
  chase: '/logos/chase.svg',
  checkoutcom: '/logos/checkoutcom.svg',
  windcave: '/logos/windcave.svg',
}

interface PSPConfig {
  name: PSPName
  label: string
  color: string
  fields: Array<{
    key: string
    label: string
    required: boolean
    sensitive: boolean
    placeholder?: string
  }>
}

const PSP_CONFIGS: PSPConfig[] = [
  {
    name: 'stripe',
    label: 'Stripe',
    color: 'from-[#635bff] to-[#a960ee]',
    fields: [
      { key: 'secret_key', label: 'Secret Key', required: true, sensitive: true, placeholder: 'sk_live_...' },
      { key: 'public_key', label: 'Publishable Key', required: false, sensitive: false, placeholder: 'pk_live_...' },
      { key: 'webhook_secret', label: 'Webhook Secret', required: false, sensitive: true, placeholder: 'whsec_...' },
    ],
  },
  {
    name: 'adyen',
    label: 'Adyen',
    color: 'from-[#0abf53] to-[#00d86f]',
    fields: [
      { key: 'api_key', label: 'API Key', required: true, sensitive: true },
      { key: 'merchant_account', label: 'Merchant Account', required: true, sensitive: false },
      { key: 'webhook_secret', label: 'HMAC Key', required: false, sensitive: true },
    ],
  },
  {
    name: 'braintree',
    label: 'Braintree',
    color: 'from-[#003366] to-[#0070ba]',
    fields: [
      { key: 'merchant_id', label: 'Merchant ID', required: true, sensitive: false },
      { key: 'public_key', label: 'Public Key', required: true, sensitive: false },
      { key: 'private_key', label: 'Private Key', required: true, sensitive: true },
    ],
  },
  {
    name: 'nuvei',
    label: 'Nuvei',
    color: 'from-[#ff6b35] to-[#ff8c5a]',
    fields: [
      { key: 'merchant_id', label: 'Merchant ID', required: true, sensitive: false },
      { key: 'merchant_site_id', label: 'Merchant Site ID', required: true, sensitive: false },
      { key: 'secret_key', label: 'Secret Key', required: true, sensitive: true },
    ],
  },
  {
    name: 'dlocal',
    label: 'dLocal',
    color: 'from-[#00a1e0] to-[#00c8ff]',
    fields: [
      { key: 'x_login', label: 'X-Login', required: true, sensitive: true },
      { key: 'x_trans_key', label: 'X-Trans-Key', required: true, sensitive: true },
      { key: 'secret_key', label: 'Secret Key', required: true, sensitive: true },
    ],
  },
  {
    name: 'airwallex',
    label: 'Airwallex',
    color: 'from-[#e21b3c] to-[#ff4d6d]',
    fields: [
      { key: 'client_id', label: 'Client ID', required: true, sensitive: false },
      { key: 'api_key', label: 'API Key', required: true, sensitive: true },
    ],
  },
  {
    name: 'authorizenet',
    label: 'Authorize.net',
    color: 'from-[#003366] to-[#0066cc]',
    fields: [
      { key: 'api_login_id', label: 'API Login ID', required: true, sensitive: false },
      { key: 'transaction_key', label: 'Transaction Key', required: true, sensitive: true },
    ],
  },
  {
    name: 'chase',
    label: 'Chase',
    color: 'from-[#117aca] to-[#1a9cff]',
    fields: [
      { key: 'orbital_connection_username', label: 'Orbital Username', required: true, sensitive: false },
      { key: 'orbital_connection_password', label: 'Orbital Password', required: true, sensitive: true },
      { key: 'merchant_id', label: 'Merchant ID', required: true, sensitive: false },
      { key: 'terminal_id', label: 'Terminal ID', required: true, sensitive: false },
    ],
  },
  {
    name: 'checkoutcom',
    label: 'Checkout.com',
    color: 'from-[#0066ff] to-[#00ccff]',
    fields: [
      { key: 'secret_key', label: 'Secret Key', required: true, sensitive: true, placeholder: 'sk_...' },
      { key: 'public_key', label: 'Public Key', required: true, sensitive: false, placeholder: 'pk_...' },
    ],
  },
  {
    name: 'windcave',
    label: 'Windcave',
    color: 'from-[#6b21a8] to-[#9333ea]',
    fields: [
      { key: 'username', label: 'REST API Username', required: true, sensitive: false, placeholder: 'your-username' },
      { key: 'api_key', label: 'REST API Key', required: true, sensitive: true, placeholder: 'your-api-key' },
    ],
  },
]

interface PSPCredential {
  id: string
  psp: PSPName
  environment: 'test' | 'live'
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function ProcessorsPage() {
  const [credentials, setCredentials] = useState<PSPCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedPSP, setSelectedPSP] = useState<PSPConfig | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [environment, setEnvironment] = useState<'test' | 'live'>('test')
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null)

  const loadCredentials = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('psp_credentials')
      .select('id, psp, environment, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (!error) {
      setCredentials(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCredentials()
  }, [])

  const handleAddCredential = async () => {
    if (!selectedPSP) return
    setError(null)
    for (const field of selectedPSP.fields) {
      if (field.required && !formData[field.key]?.trim()) {
        setError(`${field.label} is required`)
        return
      }
    }

    startTransition(async () => {
      const result = editingCredentialId
        ? await createPspCredential({
            id: editingCredentialId,
            psp: selectedPSP.name,
            environment,
            credentials: formData,
          })
        : await createPspCredential({
            psp: selectedPSP.name,
            environment,
            credentials: formData,
          })

      if (!result.success) {
        setError(result.error || 'Failed to save credential')
        return
      }

      setShowAddDialog(false)
      setSelectedPSP(null)
      setFormData({})
      setEnvironment('test')
      setEditingCredentialId(null)
      await loadCredentials()
    })
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('psp_credentials').update({ is_active: isActive }).eq('id', id)
      await loadCredentials()
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this processor credential?')) return
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('psp_credentials').delete().eq('id', id)
      await loadCredentials()
    })
  }

  const handleEdit = async (cred: PSPCredential) => {
    const config = PSP_CONFIGS.find(p => p.name === cred.psp)
    if (!config) return
    setSelectedPSP(config)
    setEnvironment(cred.environment)
    setEditingCredentialId(cred.id)
    setFormData({})
    setShowAddDialog(true)
  }

  const getConfiguredPSPs = () => credentials.map(c => c.psp)
  const getAvailablePSPs = () => PSP_CONFIGS.filter(p => !getConfiguredPSPs().includes(p.name))

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">Payment Processors</h1>
          <p className="text-slate-500 mt-1">Connect and manage your payment processor credentials</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={loadCredentials}
            disabled={loading}
            className="border-white/10 text-slate-300 hover:bg-white/5 h-10 w-10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            disabled={getAvailablePSPs().length === 0}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-medium h-10 px-6 rounded-full shadow-lg shadow-cyan-500/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Processor
          </Button>
        </div>
      </div>

      <div className="dashboard-card bg-emerald-500/5 border-emerald-500/20 p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-emerald-400 mt-0.5" />
        <div>
          <h3 className="font-medium text-white">Secure Credential Storage</h3>
          <p className="text-sm text-slate-400 mt-1">
            All credentials are encrypted at rest using AES-256 encryption. We never log or expose your API keys.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
          </div>
        ) : credentials.length === 0 ? (
          <div className="col-span-full">
            <div className="dashboard-card p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5">
                <CreditCard className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No processors connected</h3>
              <p className="text-slate-500 mb-6">Add your first payment processor to start accepting payments.</p>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-medium rounded-full h-11 px-8"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Processor
              </Button>
            </div>
          </div>
        ) : (
          credentials.map((cred) => {
            const config = PSP_CONFIGS.find(p => p.name === cred.psp)
            if (!config) return null

            return (
              <div
                key={cred.id}
                className="dashboard-card p-6 group hover:border-cyan-500/30"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-white flex items-center justify-center p-3 border border-white/10 shadow-sm">
                      <img
                        src={PSP_LOGOS[config.name]}
                        alt={`${config.label} logo`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-lg">{config.label}</h3>
                      <Badge className={cred.environment === 'live'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }>
                        {cred.environment}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(cred)}
                      disabled={isPending}
                      className="text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 h-8 w-8 rounded-full"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cred.id)}
                      disabled={isPending}
                      className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 h-8 w-8 rounded-full"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-sm">
                    {cred.is_active ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        Inactive
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={cred.is_active}
                    onCheckedChange={(checked) => handleToggleActive(cred.id, checked)}
                    disabled={isPending}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {getAvailablePSPs().length > 0 && credentials.length > 0 && (
        <div className="pt-8">
          <h2 className="dashboard-heading text-lg mb-6">Available Processors</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {getAvailablePSPs().map((psp) => (
              <button
                key={psp.name}
                onClick={() => {
                  setSelectedPSP(psp)
                  setShowAddDialog(true)
                }}
                className="dashboard-card p-5 hover:border-cyan-500/40 hover:bg-white/[0.04] text-center group"
              >
                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center p-2.5 mx-auto mb-3 shadow-sm group-hover:scale-105 transition-transform">
                  <img
                    src={PSP_LOGOS[psp.name]}
                    alt={`${psp.label} logo`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{psp.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-charcoal border-white/10 max-w-lg text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedPSP ? (editingCredentialId ? `Edit ${selectedPSP.label}` : `Connect ${selectedPSP.label}`) : 'Add Payment Processor'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedPSP
                ? 'Enter your API credentials to connect this processor.'
                : 'Select a payment processor to add.'}
            </DialogDescription>
          </DialogHeader>

          {!selectedPSP ? (
            <div className="grid grid-cols-3 gap-3 py-4">
              {getAvailablePSPs().map((psp) => (
                <button
                  key={psp.name}
                  onClick={() => setSelectedPSP(psp)}
                  className="dashboard-card p-4 hover:border-cyan-500/50 hover:bg-white/5 transition-colors text-center"
                >
                  <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center p-1.5 mx-auto mb-2">
                    <img
                      src={PSP_LOGOS[psp.name]}
                      alt={`${psp.label} logo`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-300">{psp.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                {error && (
                  <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-slate-300">Environment</Label>
                  <Select value={environment} onValueChange={(v) => setEnvironment(v as 'test' | 'live')}>
                    <SelectTrigger className="bg-obsidian border-white/10 text-white focus:border-cyan-400">
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent className="bg-charcoal border-white/10">
                      <SelectItem value="test" className="text-white hover:bg-white/5">
                        Test - Sandbox / Development
                      </SelectItem>
                      <SelectItem value="live" className="text-white hover:bg-white/5">
                        Live - Production
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedPSP.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-slate-300">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type={field.sensitive && !showSensitive[field.key] ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400"
                      />
                      {field.sensitive && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowSensitive({ ...showSensitive, [field.key]: !showSensitive[field.key] })}
                          className="border-white/10 text-slate-300 hover:bg-white/5"
                        >
                          {showSensitive[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedPSP(null)
                    setFormData({})
                    setError(null)
                  }}
                  className="border-white/10 text-slate-300 hover:bg-white/5 rounded-full px-6"
                >
                  Back
                </Button>
                <Button
                  onClick={handleAddCredential}
                  disabled={isPending}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold rounded-full px-8 shadow-lg shadow-cyan-500/20"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {editingCredentialId ? 'Save Changes' : `Connect ${selectedPSP.label}`}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}