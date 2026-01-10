'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldCheck, Terminal, CreditCard, Lock, ArrowRight, Play, CheckCircle2 } from 'lucide-react'

export default function PlaygroundPage() {
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  
  // Form state
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
    setLogs([]) // Clear previous logs
    
    addLog('Initializing secure session...')
    
    // Simulate network delay
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tokenizer Playground</h1>
        <p className="text-[#9bb0c2] mt-1">Test the Atlas Secure Frame and inspect the tokenization flow.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        {/* Left Column: The Payment Form */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#111] border border-white/10 p-6 relative overflow-hidden">
            {/* Environment Badge */}
            <div className="absolute top-4 right-4">
               <Badge className="bg-[#c8ff5a]/10 text-[#c8ff5a] border-[#c8ff5a]/20">
                 <ZapIcon className="w-3 h-3 mr-1" />
                 Sandbox
               </Badge>
            </div>

            <div className="flex items-center gap-2 mb-6 text-white">
              <CreditCard className="h-5 w-5 text-[#19d1c3]" />
              <h2 className="text-lg font-semibold">Payment Details</h2>
            </div>

            <form onSubmit={handleTokenize} className="space-y-5 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="pan" className="text-gray-300">Card Number</Label>
                <div className="relative">
                  <Input
                    id="pan"
                    placeholder="4242 4242 4242 4242"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    className="pl-10 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 font-mono"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry" className="text-gray-300">Expiry</Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc" className="text-gray-300">CVC</Label>
                  <Input
                    id="cvc"
                    placeholder="123"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    type="password"
                    className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#19d1c3] hover:bg-[#19d1c3]/90 text-black font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Tokenizing...
                    </>
                  ) : (
                    <>
                      Pay $49.90
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
                <p className="mt-3 text-xs text-center text-gray-500 flex items-center justify-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Processed securely by Atlas Vault
                </p>
              </div>
            </form>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-[#111] border border-white/10 p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
              <div className="flex items-center gap-2 text-[#c8ff5a] font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Ready
              </div>
            </div>
            <div className="rounded-xl bg-[#111] border border-white/10 p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Latency</div>
              <div className="text-white font-medium">~120ms</div>
            </div>
            <div className="rounded-xl bg-[#111] border border-white/10 p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vault</div>
              <div className="text-white font-medium">AES-256</div>
            </div>
          </div>
        </div>

        {/* Right Column: Console/Logs */}
        <div className="space-y-6">
           {/* Token Result */}
          <div className="rounded-2xl bg-[#0b111a] border border-white/10 overflow-hidden flex flex-col h-[300px]">
            <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                <Terminal className="h-4 w-4 text-[#19d1c3]" />
                Token Response
              </div>
              {token && <Badge className="bg-[#19d1c3]/20 text-[#19d1c3] border-0 text-[10px]">201 Created</Badge>}
            </div>
            <div className="p-4 overflow-auto flex-1 font-mono text-xs">
              {token ? (
                <pre className="text-[#c8ff5a]">
                  {JSON.stringify(token, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                  <Play className="h-8 w-8 opacity-20" />
                  <p>Submit the form to generate a token</p>
                </div>
              )}
            </div>
          </div>

          {/* System Logs */}
          <div className="rounded-2xl bg-[#0b111a] border border-white/10 overflow-hidden flex flex-col h-[300px]">
            <div className="px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                <ShieldCheck className="h-4 w-4 text-[#4cc3ff]" />
                Vault Logs
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1 font-mono text-xs space-y-2">
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <div key={i} className="text-gray-400 border-l-2 border-[#19d1c3]/30 pl-3">
                    {log}
                  </div>
                ))
              ) : (
                <span className="text-gray-600 italic">Waiting for input...</span>
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
