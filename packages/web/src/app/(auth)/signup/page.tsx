'use client'

import { useState, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowRight, Check, Github } from 'lucide-react'

const features = [
  'Multi-processor payment orchestration',
  'Enterprise-grade resilience',
  '3D Secure authentication',
  'Network tokenization',
  'PCI DSS compliant',
]

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const authError = searchParams.get('error')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(authError === 'auth_failed' ? 'Authentication failed. Please try again.' : null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)

  const handleGitHubSignup = async () => {
    setOauthLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback${inviteToken ? `?next=/invite/${inviteToken}` : ''}`,
      },
    })

    if (error) {
      setError(error.message)
      setOauthLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
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
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="text-slate-400 mt-2">Start accepting payments in minutes</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-6">
        {error && (
          <div className="p-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-300">Full name</Label>
          <Input
            id="name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-12 bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400 focus:ring-cyan-400/20"
          />
        </div>

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
          <Label htmlFor="password" className="text-slate-300">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-12 bg-obsidian border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-400 focus:ring-cyan-400/20"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || oauthLoading}
          className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium transition-all duration-300 shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-charcoal text-slate-500">or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGitHubSignup}
          disabled={loading || oauthLoading}
          className="w-full h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all"
        >
          {oauthLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Github className="h-5 w-5 mr-2" />
          )}
          GitHub
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function SignupFormFallback() {
  return (
    <div className="rounded-2xl bg-charcoal border border-white/10 p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="text-slate-400 mt-2">Start accepting payments in minutes</p>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex bg-obsidian selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="bg-noise" />
      
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5z"/>
              </svg>
              <span className="text-2xl font-bold text-white tracking-tight">Atlas</span>
            </Link>
          </div>

          <Suspense fallback={<SignupFormFallback />}>
            <SignupForm />
          </Suspense>

          <p className="text-center text-slate-500 text-sm mt-8">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </div>

      {/* Right side - Features (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border-l border-white/5 p-8 relative z-10">
        <div className="max-w-md">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-12">
            <svg className="w-10 h-10 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5z"/>
            </svg>
            <span className="text-3xl font-bold text-white tracking-tight">Atlas</span>
          </Link>

          <h2 className="text-3xl font-bold text-white mb-4">
            Payment orchestration for modern businesses
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Connect to multiple payment processors, optimize authorization rates, and ensure your payments never fail.
          </p>

          <div className="space-y-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Check className="h-4 w-4 text-cyan-400" />
                </div>
                <span className="text-slate-300">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <p className="text-slate-300 italic">
              &ldquo;Atlas has transformed how we handle payments. The resilience features mean we never miss a transaction.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600" />
              <div>
                <p className="text-white font-medium">Sarah Chen</p>
                <p className="text-sm text-slate-500">CTO, TechCorp</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
