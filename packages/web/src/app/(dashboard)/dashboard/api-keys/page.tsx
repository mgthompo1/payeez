'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Copy, Eye, EyeOff, Trash2, Key, AlertTriangle, Loader2, RefreshCw, Check } from 'lucide-react'
import { getApiKeys, createApiKey, revokeApiKey, onboardUser, type ApiKey, type CreateKeyResult } from './actions'

export default function ApiKeysPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyEnvironment, setNewKeyEnvironment] = useState<'test' | 'live'>('test')
  const [newKeyResult, setNewKeyResult] = useState<CreateKeyResult | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadKeys = async () => {
    setLoading(true)
    setError(null)
    try {
      const keys = await getApiKeys()
      setApiKeys(keys.filter(k => !k.is_revoked))
    } catch (err) {
      setError('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeys()
  }, [])

  const handleCreateKey = async () => {
    if (!newKeyLabel.trim()) {
      setError('Please enter a label for the key')
      return
    }

    startTransition(async () => {
      try {
        const result = await createApiKey(newKeyLabel, newKeyEnvironment)
        if (result) {
          setNewKeyResult(result)
          await loadKeys()
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create API key'
        if (message.includes('does not belong to any tenant')) {
          try {
            await onboardUser()
            const result = await createApiKey(newKeyLabel, newKeyEnvironment)
            if (result) {
              setNewKeyResult(result)
              await loadKeys()
            }
            return
          } catch (onboardErr) {
            setError('Failed to set up your account. Please try again.')
            return
          }
        }
        setError(message)
      }
    })
  }

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return
    startTransition(async () => {
      try {
        await revokeApiKey(keyId)
        await loadKeys()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to revoke API key')
      }
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatLastUsed = (date: string | null) => {
    if (!date) return 'Never'
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hours ago`
    const days = Math.floor(hours / 24)
    return `${days} days ago`
  }

  const resetDialog = () => {
    setShowCreateDialog(false)
    setNewKeyResult(null)
    setNewKeyLabel('')
    setNewKeyEnvironment('test')
    setShowKey(false)
    setError(null)
  }

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">API Keys</h1>
          <p className="text-slate-500 mt-1">Manage secret keys for authenticating API requests</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={loadKeys}
            disabled={loading}
            className="border-white/10 text-slate-300 hover:bg-white/5 h-10 w-10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-medium h-10 px-6 rounded-full shadow-lg shadow-cyan-500/20">
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-charcoal border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Create API Key</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Create a new API key for authenticating requests
                </DialogDescription>
              </DialogHeader>
              {!newKeyResult ? (
                <>
                  <div className="space-y-4 py-4">
                    {error && (
                      <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                        {error}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="label" className="text-slate-300">Label</Label>
                      <Input
                        id="label"
                        placeholder="e.g., Production Server"
                        value={newKeyLabel}
                        onChange={(e) => setNewKeyLabel(e.target.value)}
                        className="bg-obsidian border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="environment" className="text-slate-300">Environment</Label>
                      <Select
                        value={newKeyEnvironment}
                        onValueChange={(value) => setNewKeyEnvironment(value as 'test' | 'live')}
                      >
                        <SelectTrigger className="bg-obsidian border-white/10 text-white focus:border-cyan-400">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-charcoal border-white/10">
                          <SelectItem value="test" className="text-white hover:bg-white/5 focus:bg-white/5">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Test</Badge>
                              <span className="text-slate-300">For development and testing</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="live" className="text-white hover:bg-white/5 focus:bg-white/5">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Live</Badge>
                              <span className="text-slate-300">For production use</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={resetDialog}
                      className="border-white/10 text-slate-300 hover:bg-white/5 rounded-full px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateKey}
                      disabled={isPending || !newKeyLabel.trim()}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-full px-8"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Key'
                      )}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-4 py-4">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-400 font-medium">
                        Save this key now - you won&apos;t be able to see it again!
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Your new API key</Label>
                      <div className="flex gap-2">
                        <Input
                          type={showKey ? 'text' : 'password'}
                          value={newKeyResult.full_key}
                          readOnly
                          className="font-mono bg-obsidian border-white/10 text-white focus:border-cyan-400"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowKey(!showKey)}
                          className="border-white/10 text-slate-300 hover:bg-white/5 rounded-full h-10 w-10"
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(newKeyResult.full_key)}
                          className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-cyan-400 rounded-full h-10 w-10"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      {copied && (
                        <p className="text-sm text-emerald-400 font-medium flex items-center gap-1.5 mt-2">
                          <Check className="h-4 w-4" /> Copied to clipboard!
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={resetDialog}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-full px-8 w-full sm:w-auto"
                    >
                      Done
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="dashboard-card bg-cyan-500/5 border-cyan-500/20 p-4 flex items-start gap-3">
        <Key className="h-5 w-5 text-cyan-400 mt-0.5" />
        <div>
          <h3 className="font-medium text-white">Authentication Protocol</h3>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Use <code className="text-cyan-400 bg-cyan-400/10 px-1 py-0.5 rounded">sk_test_</code> keys for local development and <code className="text-cyan-400 bg-cyan-400/10 px-1 py-0.5 rounded">sk_live_</code> keys for production traffic.
            Keys must be included in the <code className="text-slate-300 font-mono italic">Authorization: Bearer</code> header of every request.
          </p>
        </div>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Active Access Keys</h2>
          <p className="text-sm text-slate-500 mt-1">Managed credentials for API access control</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Label</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Key Reference</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Environment</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Used</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                <th className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Key className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium mb-1">No API keys yet</p>
                    <p className="text-xs text-slate-600">Create your first key to start using the API</p>
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="py-4 px-6">
                      <span className="font-medium text-white group-hover:text-cyan-400 transition-colors">{key.label || 'Unnamed Key'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <code className="text-sm text-cyan-400 bg-cyan-400/5 px-2 py-1 rounded font-mono">{key.key_prefix}...</code>
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={key.environment === 'live'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }>
                        {key.environment}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-400 text-sm">{formatLastUsed(key.last_used_at)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-500 text-sm">{formatDate(key.created_at)}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={isPending}
                        className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-full h-9 w-9 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}