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

// Payment Processor Logo Components
const StripeLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
  </svg>
)

const AdyenLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M12.274 0C5.503 0 0 5.503 0 12.274V24h11.726C18.497 24 24 18.497 24 11.726V0H12.274zm4.86 16.138c-1.057 1.057-2.47 1.64-3.978 1.64h-3.56V6.222h3.56c1.508 0 2.921.583 3.978 1.64 1.057 1.057 1.64 2.47 1.64 3.978s-.583 2.921-1.64 3.978v.32z" />
  </svg>
)

const BraintreeLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M20.905 0H3.095A3.095 3.095 0 000 3.095v17.81A3.095 3.095 0 003.095 24h17.81A3.095 3.095 0 0024 20.905V3.095A3.095 3.095 0 0020.905 0zm-4.048 16.857H7.143V7.143h9.714v9.714z" />
  </svg>
)

const NuveiLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 16.5l-5.5-3.5-5.5 3.5V7.5L12 11l5.5-3.5v9z" />
  </svg>
)

const DLocalLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 21.6c-5.302 0-9.6-4.298-9.6-9.6S6.698 2.4 12 2.4s9.6 4.298 9.6 9.6-4.298 9.6-9.6 9.6zm0-16.8a7.2 7.2 0 100 14.4 7.2 7.2 0 000-14.4z" />
  </svg>
)

const AirwallexLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M23.5 12L12 0 .5 12 12 24 23.5 12zM12 18.75L5.25 12 12 5.25 18.75 12 12 18.75z" />
  </svg>
)

const AuthorizeNetLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M21.6 0H2.4A2.4 2.4 0 000 2.4v19.2A2.4 2.4 0 002.4 24h19.2a2.4 2.4 0 002.4-2.4V2.4A2.4 2.4 0 0021.6 0zM12 18l-6-6 1.41-1.41L12 15.17l4.59-4.58L18 12l-6 6z" />
  </svg>
)

const ChaseLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M1.5 14.25h7.5V6H1.5v8.25zm7.5 3.75h7.5V9.75H9v8.25zm7.5-12v8.25h6V6h-6zm0 12h6v-8.25h-6V18zM9 6v3.75h7.5V6H9z" />
  </svg>
)

const CheckoutComLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.5 17.25l-5.25-5.25 1.5-1.5 3.75 3.75 7.5-7.5 1.5 1.5-9 9z" />
  </svg>
)

const WindcaveLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
    <path d="M23.5 8c-.5-2-2-3.5-4-4-1.5-.5-3 0-4.5 1l-3 2.5L9 5c-1.5-1-3-1.5-4.5-1-2 .5-3.5 2-4 4-.5 2 0 4 1.5 5.5L12 24l10-10.5c1.5-1.5 2-3.5 1.5-5.5z" />
  </svg>
)

interface PSPConfig {
  name: PSPName
  label: string
  color: string
  icon: React.ReactNode
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
    icon: <StripeLogo />,
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
    icon: <AdyenLogo />,
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
    icon: <BraintreeLogo />,
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
    icon: <NuveiLogo />,
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
    icon: <DLocalLogo />,
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
    icon: <AirwallexLogo />,
    fields: [
      { key: 'client_id', label: 'Client ID', required: true, sensitive: false },
      { key: 'api_key', label: 'API Key', required: true, sensitive: true },
    ],
  },
  {
    name: 'authorizenet',
    label: 'Authorize.net',
    color: 'from-[#003366] to-[#0066cc]',
    icon: <AuthorizeNetLogo />,
    fields: [
      { key: 'api_login_id', label: 'API Login ID', required: true, sensitive: false },
      { key: 'transaction_key', label: 'Transaction Key', required: true, sensitive: true },
    ],
  },
  {
    name: 'chase',
    label: 'Chase',
    color: 'from-[#117aca] to-[#1a9cff]',
    icon: <ChaseLogo />,
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
    icon: <CheckoutComLogo />,
    fields: [
      { key: 'secret_key', label: 'Secret Key', required: true, sensitive: true, placeholder: 'sk_...' },
      { key: 'public_key', label: 'Public Key', required: true, sensitive: false, placeholder: 'pk_...' },
    ],
  },
  {
    name: 'windcave',
    label: 'Windcave',
    color: 'from-[#6b21a8] to-[#9333ea]',
    icon: <WindcaveLogo />,
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
  const supabase = createClient()
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

  // Load credentials
  const loadCredentials = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('psp_credentials')
      .select('id, psp, environment, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading credentials:', error)
    } else {
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

    // Validate required fields
    for (const field of selectedPSP.fields) {
      if (field.required && !formData[field.key]?.trim()) {
        setError(`${field.label} is required`)
        return
      }
    }

    startTransition(async () => {
      try {
        if (editingCredentialId) {
          // Update existing credential
          await createPspCredential({
            id: editingCredentialId,
            psp: selectedPSP.name,
            environment,
            credentials: formData,
          })
        } else {
          // Create new credential
          await createPspCredential({
            psp: selectedPSP.name,
            environment,
            credentials: formData,
          })
        }

        setShowAddDialog(false)
        setSelectedPSP(null)
        setFormData({})
        setEnvironment('test')
        setEditingCredentialId(null)
        await loadCredentials()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save credential')
      }
    })
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    startTransition(async () => {
      await supabase
        .from('psp_credentials')
        .update({ is_active: isActive })
        .eq('id', id)

      await loadCredentials()
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this processor credential?')) {
      return
    }

    startTransition(async () => {
      await supabase
        .from('psp_credentials')
        .delete()
        .eq('id', id)

      await loadCredentials()
    })
  }

  const handleEdit = async (cred: PSPCredential) => {
    const config = getPSPConfig(cred.psp)
    if (!config) return

    // Fetch the current credentials to pre-fill the form
    const { data } = await supabase
      .from('psp_credentials')
      .select('credentials_encrypted')
      .eq('id', cred.id)
      .single()

    // Note: We can't decrypt here (client-side), so we'll just show empty fields
    // User needs to re-enter credentials when editing
    setSelectedPSP(config)
    setEnvironment(cred.environment)
    setEditingCredentialId(cred.id)
    setFormData({}) // Can't pre-fill encrypted fields
    setShowAddDialog(true)
  }

  const getPSPConfig = (name: PSPName) => PSP_CONFIGS.find(p => p.name === name)

  const getConfiguredPSPs = () => credentials.map(c => c.psp)
  const getAvailablePSPs = () => PSP_CONFIGS.filter(p => !getConfiguredPSPs().includes(p.name))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payment Processors</h1>
          <p className="text-gray-500 mt-1">Connect and manage your payment processor credentials</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadCredentials}
            disabled={loading}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            disabled={getAvailablePSPs().length === 0}
            className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Processor
          </Button>
        </div>
      </div>

      {/* Security notice */}
      <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-green-400 mt-0.5" />
        <div>
          <h3 className="font-medium text-white">Secure Credential Storage</h3>
          <p className="text-sm text-gray-400 mt-1">
            All credentials are encrypted at rest using AES-256 encryption. We never log or expose your API keys.
          </p>
        </div>
      </div>

      {/* Configured processors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 text-[#19d1c3] animate-spin" />
          </div>
        ) : credentials.length === 0 ? (
          <div className="col-span-full">
            <div className="rounded-2xl bg-[#111] border border-white/10 p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No processors connected</h3>
              <p className="text-gray-500 mb-6">Add your first payment processor to start accepting payments.</p>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Processor
              </Button>
            </div>
          </div>
        ) : (
          credentials.map((cred) => {
            const config = getPSPConfig(cred.psp)
            if (!config) return null

            return (
              <div
                key={cred.id}
                className="rounded-xl bg-[#111] border border-white/10 p-6 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-2xl`}>
                      {config.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{config.label}</h3>
                      <Badge className={cred.environment === 'live'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }>
                        {cred.environment}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={cred.is_active}
                      onCheckedChange={(checked) => handleToggleActive(cred.id, checked)}
                      disabled={isPending}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(cred)}
                      disabled={isPending}
                      className="text-gray-400 hover:text-[#19d1c3] hover:bg-[#19d1c3]/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cred.id)}
                      disabled={isPending}
                      className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  {cred.is_active ? (
                    <>
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-400">Active</span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-500">Inactive</span>
                    </>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Added {new Date(cred.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Available processors */}
      {getAvailablePSPs().length > 0 && credentials.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Available Processors</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {getAvailablePSPs().map((psp) => (
              <button
                key={psp.name}
                onClick={() => {
                  setSelectedPSP(psp)
                  setShowAddDialog(true)
                }}
                className="rounded-xl bg-[#111] border border-white/10 p-4 hover:border-[#19d1c3]/50 transition-colors text-center"
              >
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${psp.color} flex items-center justify-center text-xl mx-auto mb-2`}>
                  {psp.icon}
                </div>
                <span className="text-sm text-gray-300">{psp.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Processor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#111] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedPSP ? (editingCredentialId ? `Edit ${selectedPSP.label}` : `Connect ${selectedPSP.label}`) : 'Add Payment Processor'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
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
                  className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-[#19d1c3]/50 transition-colors text-center"
                >
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${psp.color} flex items-center justify-center text-xl mx-auto mb-2`}>
                    {psp.icon}
                  </div>
                  <span className="text-sm text-gray-300">{psp.label}</span>
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
                  <Label className="text-gray-300">Environment</Label>
                  <Select value={environment} onValueChange={(v) => setEnvironment(v as 'test' | 'live')}>
                    <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111] border-white/10">
                      <SelectItem value="test" className="text-white hover:bg-white/5">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Test</Badge>
                          <span>Sandbox / Development</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="live" className="text-white hover:bg-white/5">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Live</Badge>
                          <span>Production</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedPSP.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-gray-300">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type={field.sensitive && !showSensitive[field.key] ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
                      />
                      {field.sensitive && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowSensitive({ ...showSensitive, [field.key]: !showSensitive[field.key] })}
                          className="border-white/10 text-gray-300 hover:bg-white/5"
                        >
                          {showSensitive[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedPSP(null)
                    setFormData({})
                    setError(null)
                  }}
                  className="border-white/10 text-gray-300 hover:bg-white/5"
                >
                  Back
                </Button>
                <Button
                  onClick={handleAddCredential}
                  disabled={isPending}
                  className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
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
