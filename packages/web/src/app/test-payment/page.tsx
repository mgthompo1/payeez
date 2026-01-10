'use client'

import { useState, useEffect } from 'react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yssswpqpwrrglgroxwok.supabase.co'

export default function TestPaymentPage() {
  const [step, setStep] = useState(1)
  const [sessionId, setSessionId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])

  const apiKey = 'sk_test_hICk1zwHHZC0xhR8yqOsf1a37HG4a8'
  const functionsUrl = `${SUPABASE_URL}/functions/v1`

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  // Step 1: Create a payment session
  const createSession = async () => {
    setLoading(true)
    setError('')
    addLog('Creating payment session...')

    try {
      const res = await fetch(`${functionsUrl}/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          amount: 1000, // $10.00
          currency: 'NZD',
          capture_method: 'automatic',
          metadata: {
            order_id: 'test-' + Date.now(),
            customer_email: 'test@example.com',
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session')
      }

      addLog(`Session created: ${data.id}`)
      addLog(`Client secret: ${data.client_secret?.slice(0, 20)}...`)
      setSessionId(data.id)
      setClientSecret(data.client_secret)
      setStep(2)
    } catch (err: any) {
      setError(err.message)
      addLog(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Mount the Elements iframe
  useEffect(() => {
    if (step === 2 && sessionId) {
      addLog('Mounting payment form iframe...')
      // The iframe will be mounted in the container
    }
  }, [step, sessionId])

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {}

      switch (type) {
        case 'ATLAS_READY':
          addLog('Payment form ready')
          break
        case 'ATLAS_CHANGE':
          if (payload?.complete) {
            addLog('Form complete - ready to submit')
          }
          break
        case 'ATLAS_TOKEN_CREATED':
          addLog(`Token created: ${payload?.tokenId}`)
          confirmPayment(payload?.tokenId)
          break
        case 'ATLAS_ERROR':
          addLog(`Form error: ${payload?.message}`)
          setError(payload?.message)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sessionId, clientSecret])

  // Step 3: Confirm the payment
  const confirmPayment = async (tokenId: string) => {
    addLog('Confirming payment with Windcave...')
    setLoading(true)

    try {
      const res = await fetch(`${functionsUrl}/confirm-payment/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clientSecret}`,
        },
        body: JSON.stringify({
          session_id: sessionId, // Also include in body as fallback
          token_id: tokenId,
          token_provider: 'atlas', // Using Atlas Native Vault
        }),
      })

      const data = await res.json()
      console.log('Confirm payment response:', data)

      if (!res.ok) {
        const errorMsg = data.error || data.message || 'Payment failed'
        const errorCode = data.code || data.failure_code || ''
        const errorDetails = data.attempts ? `(${data.attempts} attempts, last PSP: ${data.last_psp})` : ''
        throw new Error(`${errorMsg} ${errorCode} ${errorDetails}`.trim())
      }

      addLog(`Payment ${data.status}: ${data.psp_transaction_id || data.id}`)
      setResult(data)
      setStep(3)
    } catch (err: any) {
      setError(err.message)
      addLog(`Payment error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Trigger confirm from iframe
  const submitPayment = () => {
    const iframe = document.querySelector('iframe')
    if (iframe?.contentWindow) {
      addLog('Submitting payment form...')
      iframe.contentWindow.postMessage({ type: 'ATLAS_CONFIRM' }, '*')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Atlas Payment Test</h1>
        <p className="text-gray-400 mb-8">End-to-end test of the Windcave integration</p>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-[#19d1c3] text-black' : 'bg-white/10 text-gray-500'
              }`}>
                {s}
              </div>
              <span className={step >= s ? 'text-white' : 'text-gray-500'}>
                {s === 1 ? 'Create Session' : s === 2 ? 'Enter Card' : 'Complete'}
              </span>
              {s < 3 && <div className="w-8 h-px bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Left: Payment Form */}
          <div className="space-y-6">
            {step === 1 && (
              <div className="rounded-xl bg-[#111] border border-white/10 p-6">
                <h2 className="text-lg font-semibold mb-4">Step 1: Create Payment Session</h2>
                <div className="space-y-3 text-sm text-gray-400 mb-6">
                  <p><strong className="text-white">Amount:</strong> $10.00 NZD</p>
                  <p><strong className="text-white">API Key:</strong> {apiKey.slice(0, 15)}...</p>
                  <p><strong className="text-white">PSP:</strong> Windcave</p>
                </div>
                <button
                  onClick={createSession}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] text-black font-semibold rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Payment Session'}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="rounded-xl bg-[#111] border border-white/10 p-6">
                <h2 className="text-lg font-semibold mb-4">Step 2: Enter Card Details</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Use test card: <code className="text-[#19d1c3]">4111 1111 1111 1111</code>
                </p>

                {/* Elements iframe */}
                <div className="rounded-lg overflow-hidden border border-white/10 mb-4">
                  <iframe
                    src={`http://localhost:3001?sessionId=${sessionId}&parentOrigin=${encodeURIComponent(window.location.origin)}`}
                    className="w-full h-[400px] border-0"
                    title="Payment form"
                  />
                </div>

                <button
                  onClick={submitPayment}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] text-black font-semibold rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Pay $10.00 NZD'}
                </button>
              </div>
            )}

            {step === 3 && result && (
              <div className="rounded-xl bg-[#111] border border-green-500/30 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-green-400">Payment Successful!</h2>
                    <p className="text-sm text-gray-400">Transaction completed via Windcave</p>
                  </div>
                </div>
                <pre className="text-xs bg-black/50 p-4 rounded-lg overflow-auto max-h-60">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Right: Logs */}
          <div className="rounded-xl bg-[#111] border border-white/10 p-6">
            <h2 className="text-lg font-semibold mb-4">Event Log</h2>
            <div className="bg-black/50 rounded-lg p-4 h-[500px] overflow-auto font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-500">Waiting for events...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-gray-300 mb-1">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
