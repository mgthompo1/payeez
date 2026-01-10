'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldCheck, Terminal, CreditCard, Lock, ArrowRight, Play, CheckCircle2, RefreshCw } from 'lucide-react'

export default function PlaygroundPage() {
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  
  const [pan, setPan] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')

  const addLog = (message: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev])
  }

  const handleTokenize = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setToken(null)
    setLogs([])
    
    addLog('Initializing secure session...')
    setTimeout(() => {
      addLog('Secure Frame: Capturing card data...')
      setTimeout(() => {
        addLog('Vault: Encrypting sensitive fields (AES-256-GCM)...')
        setTimeout(() => {
          const newToken = {
            id: `tok_${Math.random().toString(36).substring(2, 10)}`,
            created: Math.floor(Date.now() / 1000),
            type: 'card',
            card: {
              brand: 'visa',
              last4: pan.slice(-4) || '4242',
              exp_month: parseInt(expiry.split('/')[0]) || 12,
              exp_year: parseInt(expiry.split('/')[1]) || 2025,
              funding: 'credit'
            },
            livemode: false
          }
          setToken(newToken)
          addLog(`Tokenization successful: ${newToken.id}`)
          setLoading(false)
        }, 600)
      }, 600)
    }, 800)
  }

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="dashboard-heading text-2xl">Tokenizer Playground</h1>
        <p className="text-slate-500 mt-1">Interact with the Atlas Secure Frame and inspect the underlying cryptographic flow.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-8">
          <div className="dashboard-card p-8 relative overflow-hidden">
            <div className="absolute top-6 right-6">
               <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                 <ZapIcon className="w-3 h-3 mr-1.5" />
                 Sandbox Environment
               </Badge>
            </div>

            <div className="flex items-center gap-3 mb-10">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <CreditCard className="h-5 w-5 text-cyan-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Payment Orchestration</h2>
            </div>

            <form onSubmit={handleTokenize} className="space-y-6 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="pan" className="text-slate-300">Card Number</Label>
                <div className="relative">
                  <Input
                    id="pan"
                    placeholder="4242 4242 4242 4242"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    className="pl-10 bg-obsidian border-white/10 text-white placeholder:text-slate-600 font-mono focus:border-cyan-400"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry" className="text-slate-300">Expiry</Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="bg-obsidian border-white/10 text-white placeholder:text-slate-600 font-mono focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc" className="text-slate-300">CVC</Label>
                  <Input
                    id="cvc"
                    placeholder="123"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    type="password"
                    className="bg-obsidian border-white/10 text-white placeholder:text-slate-600 font-mono focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold h-12 rounded-full shadow-lg shadow-cyan-500/20 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Tokenizing...
                    </>
                  ) : (
                    <>
                      Execute Tokenization
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold text-slate-500">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  Secured by Atlas PCI-DSS Vault
                </div>
              </div>
            </form>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'System Status', value: 'Ready', icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'Network Latency', value: '~120ms', icon: RefreshCw, color: 'text-cyan-400' },
              { label: 'Encryption', value: 'AES-256', icon: Lock, color: 'text-blue-400' },
            ].map((item, i) => (
              <div key={i} className="dashboard-card p-5">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">{item.label}</div>
                <div className={`flex items-center gap-2 font-semibold ${item.color}`}>
                  <item.icon className="h-4 w-4" />
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="dashboard-card overflow-hidden flex flex-col h-[350px]">
            <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                <Terminal className="h-4 w-4 text-cyan-400" />
                Response
              </div>
              {token && <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px] font-mono">201 OK</Badge>}
            </div>
            <div className="p-5 overflow-auto flex-1 font-mono text-xs bg-black/20">
              {token ? (
                <pre className="text-cyan-400 leading-relaxed">
                  {JSON.stringify(token, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
                  <Play className="h-8 w-8 opacity-10" />
                  <p className="text-[10px] uppercase tracking-widest font-bold">Awaiting Transaction</p>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-card overflow-hidden flex flex-col h-[350px]">
            <div className="px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                Engine Logs
              </div>
            </div>
            <div className="p-5 overflow-auto flex-1 font-mono text-xs bg-black/20 space-y-3">
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <div key={i} className="text-slate-400 border-l border-cyan-500/30 pl-4 py-0.5">
                    {log}
                  </div>
                ))
              ) : (
                <span className="text-slate-600 italic">No events recorded.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ZapIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}