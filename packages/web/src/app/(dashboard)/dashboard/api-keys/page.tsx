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
import { Plus, Copy, Eye, EyeOff, Trash2, Key, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
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

  // Load API keys
  const loadKeys = async () => {
    setLoading(true)
    setError(null)
    try {
      const keys = await getApiKeys()
      setApiKeys(keys.filter(k => !k.is_revoked))
    } catch (err) {
      setError('Failed to load API keys')
      console.error(err)
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

        // If user doesn't have a tenant, auto-onboard them
        if (message.includes('does not belong to any tenant')) {
          try {
            await onboardUser()
            // Retry creating the key
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
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return
    }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-gray-500 mt-1">Manage your API keys for authentication</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadKeys}
            disabled={loading}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white">Create API Key</DialogTitle>
                <DialogDescription className="text-gray-400">
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
                      <Label htmlFor="label" className="text-gray-300">Label</Label>
                      <Input
                        id="label"
                        placeholder="e.g., Production Server"
                        value={newKeyLabel}
                        onChange={(e) => setNewKeyLabel(e.target.value)}
                        className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="environment" className="text-gray-300">Environment</Label>
                      <Select
                        value={newKeyEnvironment}
                        onValueChange={(value) => setNewKeyEnvironment(value as 'test' | 'live')}
                      >
                        <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111] border-white/10">
                          <SelectItem value="test" className="text-white hover:bg-white/5">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Test</Badge>
                              <span>For development and testing</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="live" className="text-white hover:bg-white/5">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Live</Badge>
                              <span>For production use</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={resetDialog}
                      className="border-white/10 text-gray-300 hover:bg-white/5"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateKey}
                      disabled={isPending || !newKeyLabel.trim()}
                      className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
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
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-400">
                        Save this key now - you won&apos;t be able to see it again!
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Your new API key</Label>
                      <div className="flex gap-2">
                        <Input
                          type={showKey ? 'text' : 'password'}
                          value={newKeyResult.full_key}
                          readOnly
                          className="font-mono bg-[#0a0a0a] border-white/10 text-white"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowKey(!showKey)}
                          className="border-white/10 text-gray-300 hover:bg-white/5"
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(newKeyResult.full_key)}
                          className="border-white/10 text-gray-300 hover:bg-white/5"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      {copied && (
                        <p className="text-sm text-green-400">Copied to clipboard!</p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={resetDialog}
                      className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90"
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

      {/* Info about API Keys */}
      <div className="rounded-xl bg-gradient-to-br from-[#19d1c3]/10 to-[#c8ff5a]/10 border border-[#19d1c3]/20 p-4 flex items-start gap-3">
        <Key className="h-5 w-5 text-[#19d1c3] mt-0.5" />
        <div>
          <h3 className="font-medium text-white">How API Keys Work</h3>
          <p className="text-sm text-gray-400 mt-1">
            Use <code className="text-[#19d1c3]">sk_test_</code> keys for development and <code className="text-[#19d1c3]">sk_live_</code> keys for production.
            Include your key in the <code className="text-[#19d1c3]">Authorization: Bearer</code> header.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Active Keys</h2>
          <p className="text-sm text-gray-500 mt-1">Keys are used to authenticate API requests. Keep them secret!</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Environment</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="h-8 w-8 text-[#19d1c3] animate-spin mb-4" />
                      <p className="text-gray-400">Loading API keys...</p>
                    </div>
                  </td>
                </tr>
              ) : apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                        <Key className="h-6 w-6 text-gray-500" />
                      </div>
                      <p className="text-gray-400 mb-2">No API keys yet</p>
                      <p className="text-sm text-gray-500">Create your first API key to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-medium text-white">{key.label || 'Unnamed Key'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <code className="text-sm text-[#19d1c3] bg-[#19d1c3]/10 px-2 py-1 rounded">{key.key_prefix}...</code>
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={key.environment === 'live'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }>
                        {key.environment}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-400">{formatLastUsed(key.last_used_at)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-500 text-sm">{formatDate(key.created_at)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={isPending}
                        className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
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
