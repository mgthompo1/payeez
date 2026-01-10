'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Play, Loader2, Copy, Check, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'

interface ApiExplorerProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  endpoint: string
  description?: string
  defaultBody?: Record<string, any>
  requiredParams?: string[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.atlas.co/functions/v1'

export function ApiExplorer({ method, endpoint, description, defaultBody = {}, requiredParams = [] }: ApiExplorerProps) {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [body, setBody] = useState(JSON.stringify(defaultBody, null, 2))
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{ status: number; data: any; duration: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const methodColors = {
    GET: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    POST: 'bg-green-500/10 text-green-400 border-green-500/20',
    PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
    PATCH: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }

  const executeRequest = async () => {
    if (!apiKey) {
      setError('Please enter your API key')
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)
    const startTime = Date.now()

    try {
      let parsedBody: any = null
      if (method !== 'GET' && body.trim()) {
        try {
          parsedBody = JSON.parse(body)
        } catch {
          setError('Invalid JSON in request body')
          setLoading(false)
          return
        }
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        ...(parsedBody && { body: JSON.stringify(parsedBody) }),
      })

      const duration = Date.now() - startTime
      let data: any

      try {
        data = await res.json()
      } catch {
        data = { message: 'No JSON response' }
      }

      setResponse({ status: res.status, data, duration })
    } catch (err: any) {
      setError(err.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400'
    if (status >= 400 && status < 500) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
      >
        <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <Play className="h-4 w-4 text-cyan-400" />
        </div>
        <span className="text-sm font-medium text-cyan-400">Try It</span>
        <Badge className={`${methodColors[method]} font-mono text-xs px-2 py-0.5`}>
          {method}
        </Badge>
        <code className="text-xs text-slate-400 font-mono">{endpoint}</code>
        <div className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-4 pt-0 border-t border-white/10 space-y-4">
          {description && (
            <p className="text-sm text-slate-400">{description}</p>
          )}

          {/* API Key Input */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-xs">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk_test_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400 pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Request Body */}
          {method !== 'GET' && (
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Request Body</Label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full h-40 bg-obsidian border border-white/10 rounded-lg p-3 text-xs font-mono text-cyan-400 focus:border-cyan-400 focus:outline-none resize-none"
                spellCheck={false}
              />
            </div>
          )}

          {/* Execute Button */}
          <Button
            onClick={executeRequest}
            disabled={loading || !apiKey}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-semibold h-10 rounded-full shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Send Request
              </>
            )}
          </Button>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Label className="text-slate-300 text-xs">Response</Label>
                  <Badge className={`${getStatusColor(response.status)} bg-white/5 border-white/10 font-mono text-xs`}>
                    {response.status}
                  </Badge>
                  <span className="text-xs text-slate-500">{response.duration}ms</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyResponse}
                  className="text-slate-400 hover:text-cyan-400 h-7 px-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-obsidian rounded-lg border border-white/10 p-3 max-h-60 overflow-auto">
                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                  {JSON.stringify(response.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
