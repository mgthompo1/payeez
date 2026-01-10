'use client'

import { useState, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowRight } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(inviteToken ? `/invite/${inviteToken}` : '/dashboard')
    router.refresh()
  }

  return (
    <div className="rounded-2xl bg-charcoal border border-white/10 p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-slate-400 mt-2">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {error && (
          <div className="p-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400 focus:ring-cyan-400/20"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-300">Password</Label>
            <Link href="/forgot-password" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-12 bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400 focus:ring-cyan-400/20"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium transition-all duration-300 shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

function LoginFormFallback() {
  return (
    <div className="rounded-2xl bg-charcoal border border-white/10 p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-slate-400 mt-2">Sign in to your account to continue</p>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian relative selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="bg-noise" />
      
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md mx-4 z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-3">
            <svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5z"/>
            </svg>
            <span className="text-2xl font-bold text-white tracking-tight">Atlas</span>
          </Link>
        </div>

        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-slate-500 text-sm mt-8">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
