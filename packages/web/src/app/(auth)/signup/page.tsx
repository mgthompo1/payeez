'use client'

import { useState, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowRight, Check } from 'lucide-react'

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
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    <div className="rounded-2xl bg-[#111] border border-white/10 p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="text-gray-500 mt-2">Start accepting payments in minutes</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-6">
        {error && (
          <div className="p-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-gray-300">Full name</Label>
          <Input
            id="name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-12 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500 focus:border-[#19d1c3] focus:ring-[#19d1c3]/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-300">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500 focus:border-[#19d1c3] focus:ring-[#19d1c3]/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-300">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-12 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-500 focus:border-[#19d1c3] focus:ring-[#19d1c3]/20"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90 text-white font-medium"
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
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-[#19d1c3] hover:text-[#4cc3ff] font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function SignupFormFallback() {
  return (
    <div className="rounded-2xl bg-[#111] border border-white/10 p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="text-gray-500 mt-2">Start accepting payments in minutes</p>
      </div>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#19d1c3]" />
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#19d1c3]/20 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#c8ff5a]/20 rounded-full blur-[100px]" />
        </div>

        <div className="relative w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/brand/payeez-mark.svg"
                alt="Payeez"
                width={40}
                height={40}
                className="h-10 w-10"
                priority
              />
              <span className="text-2xl font-bold text-white">Payeez</span>
            </Link>
          </div>

          <Suspense fallback={<SignupFormFallback />}>
            <SignupForm />
          </Suspense>

          <p className="text-center text-gray-600 text-sm mt-8">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-gray-400 hover:text-white">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-gray-400 hover:text-white">Privacy Policy</Link>
          </p>
        </div>
      </div>

      {/* Right side - Features (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-[#19d1c3]/10 to-[#c8ff5a]/10 border-l border-white/10 p-8">
        <div className="max-w-md">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-12">
            <Image
              src="/brand/payeez-mark.svg"
              alt="Payeez"
              width={48}
              height={48}
              className="h-12 w-12"
            />
            <span className="text-3xl font-bold text-white">Payeez</span>
          </Link>

          <h2 className="text-3xl font-bold text-white mb-4">
            Payment orchestration for modern businesses
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Connect to multiple payment processors, optimize authorization rates, and ensure your payments never fail.
          </p>

          <div className="space-y-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="h-4 w-4 text-green-400" />
                </div>
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 rounded-xl bg-white/5 border border-white/10">
            <p className="text-gray-400 italic">
              &ldquo;Payeez has transformed how we handle payments. The resilience features mean we never miss a transaction.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#19d1c3] to-[#c8ff5a]" />
              <div>
                <p className="text-white font-medium">Sarah Chen</p>
                <p className="text-sm text-gray-500">CTO, TechCorp</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
