import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Terminal,
  ShieldCheck,
  GitBranch,
  Zap,
  Gauge,
  Cpu,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react'

const processors = ['Stripe', 'Adyen', 'Authorize.net', 'Chase', 'Nuvei', 'dLocal', 'Braintree', 'Checkout.com', 'Airwallex']

const pillars = [
  {
    title: 'Routing Engine',
    description: 'Weighted splits, conditional rules, and adaptive retries across every PSP.',
    icon: GitBranch,
  },
  {
    title: 'Resilience Layer',
    description: 'Circuit breakers, multi-region endpoints, and emergency direct-PSP routing.',
    icon: Zap,
  },
  {
    title: 'Vaulted Capture',
    description: 'Basis Theory tokenization keeps card data out of scope, always.',
    icon: ShieldCheck,
  },
  {
    title: 'Unified Events',
    description: 'Normalized webhooks and consistent error taxonomy across providers.',
    icon: Activity,
  },
  {
    title: 'Latency Control',
    description: 'Live processor health, routing telemetry, and SLA-aware decisions.',
    icon: Gauge,
  },
  {
    title: 'Programmable Rules',
    description: 'Route by currency, amount, BIN, or region with a single API.',
    icon: Cpu,
  },
]

const steps = [
  {
    title: 'Create a session',
    description: 'Your server defines amount, currency, and allowed methods. We return a client secret.',
    icon: Terminal,
  },
  {
    title: 'Mount the SDK',
    description: 'Secure fields render instantly, tokenize with Basis Theory, then hand off.',
    icon: Layers,
  },
  {
    title: 'Route the payment',
    description: 'Rules select the best PSP, retries kick in, and you get a unified event.',
    icon: Zap,
  },
]

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--brand-ink)] text-white">
      <div className="absolute inset-0 bg-signal" />
      <div className="absolute inset-0 bg-grid-tech opacity-40" />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/payeez-mark.svg"
              alt="Payeez"
              width={36}
              height={36}
              className="h-9 w-9"
              priority
            />
            <div className="leading-tight">
              <div className="text-sm tracking-[0.2em] text-[#c8ff5a]/80 uppercase">Payeez</div>
              <div className="text-xs text-[#8ba3b7]">Payment Orchestration</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#9bb0c2]">
            <Link href="/dashboard/docs" className="hover:text-white transition-colors">Docs</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/security" className="hover:text-white transition-colors">Security</Link>
            <Link href="/status" className="hover:text-white transition-colors">Status</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-[#9bb0c2] hover:text-white transition-colors">
              Sign in
            </Link>
            <Button asChild className="rounded-full px-5 bg-[#c8ff5a] text-[#081014] hover:bg-[#d9ff7a]">
              <Link href="/signup">Start sandbox</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 lg:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#9bb0c2] fade-up">
                <span className="h-2 w-2 rounded-full bg-[#19d1c3] shadow-[0_0_12px_#19d1c3]" />
                9 processors live
              </div>

              <div className="space-y-6">
                <h1 className="text-4xl md:text-6xl font-semibold leading-tight fade-up fade-up-1">
                  Orchestrate payments
                  <span className="block text-[#c8ff5a]">like infrastructure.</span>
                </h1>
                <p className="text-lg text-[#9bb0c2] max-w-xl fade-up fade-up-2">
                  Payeez is the routing brain between your checkout and every PSP. Build once,
                  route everywhere, and keep control of latency, cost, and success rates.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 fade-up fade-up-3">
                <Button size="lg" asChild className="h-12 rounded-full bg-[#19d1c3] text-[#081014] hover:bg-[#3be3d2]">
                  <Link href="/signup">
                    Get live in hours
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 rounded-full border-white/20 bg-white/5 hover:bg-white/10">
                  <Link href="/dashboard/docs">
                    <Terminal className="mr-2 h-4 w-4" />
                    Read the docs
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs text-[#9bb0c2]">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[#c8ff5a] text-lg font-semibold">9</div>
                  <div>Processors live</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[#19d1c3] text-lg font-semibold">150ms</div>
                  <div>Median route time</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[#4cc3ff] text-lg font-semibold">99.95%</div>
                  <div>Failover coverage</div>
                </div>
              </div>
            </div>

            <div className="relative fade-up fade-up-2">
              <div className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-[#19d1c3]/30 via-transparent to-[#c8ff5a]/20 blur-2xl" />
              <div className="relative rounded-3xl border border-white/10 bg-[#0f1621]/90 p-6 backdrop-blur">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#8ba3b7]">
                  <span>Routing Console</span>
                  <span className="text-[#c8ff5a]">Live</span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-[#9bb0c2]">Stripe</div>
                    <div className="text-white text-lg font-semibold">42%</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-[#9bb0c2]">Adyen</div>
                    <div className="text-white text-lg font-semibold">31%</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-[#9bb0c2]">Fallback</div>
                    <div className="text-white text-lg font-semibold">27%</div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b111a] p-4">
                  <div className="flex items-center justify-between text-xs text-[#8ba3b7]">
                    <span>Latency by region</span>
                    <span className="text-[#19d1c3]">Stable</span>
                  </div>
                  <div className="mt-4 relative h-32 rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent overflow-hidden">
                    <div className="absolute left-4 top-4 h-3 w-3 rounded-full bg-[#19d1c3] shadow-[0_0_12px_#19d1c3]" />
                    <div className="absolute right-6 top-6 h-3 w-3 rounded-full bg-[#c8ff5a] shadow-[0_0_12px_#c8ff5a]" />
                    <div className="absolute left-6 bottom-6 h-3 w-3 rounded-full bg-[#4cc3ff] shadow-[0_0_12px_#4cc3ff]" />
                    <div className="absolute left-5 top-5 h-[2px] w-[70%] bg-gradient-to-r from-[#19d1c3] via-[#4cc3ff] to-transparent glow-sweep" />
                    <div className="absolute left-8 bottom-8 h-[2px] w-[60%] bg-gradient-to-r from-[#4cc3ff] via-[#c8ff5a] to-transparent" />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-[#9bb0c2]">
                  <div className="flex items-center justify-between">
                    <span>Failure shield</span>
                    <span className="text-[#c8ff5a]">0.07%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10">
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a]" style={{ width: '94%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-10 text-sm text-[#8ba3b7]">
            {processors.map((name) => (
              <span key={name} className="uppercase tracking-[0.2em] text-[10px] text-[#8ba3b7]">
                {name}
              </span>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-[#8ba3b7]">Capabilities</p>
              <h2 className="text-3xl md:text-4xl font-semibold">More than a gateway. Smarter routing.</h2>
            </div>
            <p className="text-[#9bb0c2] max-w-xl">
              Route every transaction with intelligent rules, automatic failover,
              and real-time visibility across all your processors.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pillars.map((item, index) => (
              <div
                key={item.title}
                className={`rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur fade-up fade-up-${(index % 4) + 1}`}
              >
                <div className="flex items-center gap-3 text-sm text-[#9bb0c2]">
                  <div className="h-10 w-10 rounded-xl bg-[#0b111a] border border-white/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-[#19d1c3]" />
                  </div>
                  <span className="uppercase tracking-[0.25em] text-[10px]">Module</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-[#9bb0c2]">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="rounded-3xl border border-white/10 bg-[#0f1621]/90 p-10">
            <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-[#8ba3b7]">How it works</p>
                <h2 className="text-3xl md:text-4xl font-semibold">Three steps, zero card data risk.</h2>
                <p className="text-[#9bb0c2] max-w-lg">
                  Basis Theory captures the data, Payeez handles orchestration, and you own the outcome.
                </p>
              </div>
              <Button asChild className="rounded-full bg-white/10 border border-white/10 hover:bg-white/20">
                <Link href="/dashboard/docs">View integration guide</Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-[#0b111a] p-6">
                  <div className="flex items-center justify-between text-sm text-[#8ba3b7]">
                    <span className="text-xs uppercase tracking-[0.2em]">0{index + 1}</span>
                    <step.icon className="h-5 w-5 text-[#c8ff5a]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-[#9bb0c2]">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-[0.3em] text-[#8ba3b7]">API surface</p>
              <h2 className="text-3xl md:text-4xl font-semibold">Predictable responses across every PSP.</h2>
              <p className="text-[#9bb0c2]">
                Standardize payments without giving up control. Every call returns the same schema,
                including routing metadata and processor outcomes.
              </p>
              <div className="space-y-3">
                {[
                  'Idempotent create-session with automatic dedupe',
                  'Signed webhooks with strict replay protection',
                  'Normalized errors and decline categories',
                  'Typed SDK with payments, 3DS, and network tokens',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-[#9bb0c2]">
                    <div className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <ChevronRight className="h-4 w-4 text-[#c8ff5a]" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b111a] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 text-xs text-[#8ba3b7]">
                <span className="font-mono">confirm-payment.ts</span>
                <span className="ml-auto rounded-full bg-[#19d1c3]/20 px-2 py-1 text-[10px] text-[#19d1c3]">200 OK</span>
              </div>
              <pre className="p-6 text-sm font-mono text-[#c4d2e1] overflow-x-auto">
{`{
  "id": "pay_2xK9mN7vQ3",
  "status": "captured",
  "amount": 4990,
  "currency": "USD",
  "psp": "stripe",
  "card": {
    "brand": "visa",
    "last4": "4242"
  },
  "routing": {
    "attempts": 1,
    "selected_psp": "stripe",
    "selection_reason": "weighted_random"
  }
}`}
              </pre>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-28">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#19d1c3]/20 via-[#0f1621] to-[#c8ff5a]/20 p-12 text-center">
            <div className="absolute inset-0 bg-grid-tech opacity-30" />
            <div className="relative space-y-6">
              <h2 className="text-3xl md:text-5xl font-semibold">Start routing payments in minutes.</h2>
              <p className="text-[#9bb0c2] max-w-2xl mx-auto">
                Launch with a sandbox today, go live when your routing rules are ready.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild className="h-12 rounded-full bg-[#c8ff5a] text-[#081014] hover:bg-[#d9ff7a]">
                  <Link href="/signup">
                    Create sandbox
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 rounded-full border-white/20 bg-white/5 hover:bg-white/10">
                  <Link href="/contact">Talk to Payeez</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/payeez-mark.svg"
                alt="Payeez"
                width={36}
                height={36}
                className="h-9 w-9"
              />
              <span className="text-sm tracking-[0.3em] uppercase text-[#9bb0c2]">Payeez</span>
            </div>
            <p className="text-sm text-[#9bb0c2]">
              Smart payment routing for teams who want control over every transaction.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Product</h4>
            <div className="space-y-2 text-sm text-[#9bb0c2]">
              <Link href="/dashboard/docs" className="hover:text-white transition-colors">Documentation</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/changelog" className="hover:text-white transition-colors">Changelog</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Company</h4>
            <div className="space-y-2 text-sm text-[#9bb0c2]">
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
              <Link href="/careers" className="hover:text-white transition-colors">Careers</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Trust</h4>
            <div className="space-y-2 text-sm text-[#9bb0c2]">
              <Link href="/security" className="hover:text-white transition-colors">Security</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 px-6 pt-6 text-xs text-[#8ba3b7] md:flex-row">
          <span>© 2024 Payeez. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="https://twitter.com" className="hover:text-white transition-colors">X</Link>
            <Link href="https://github.com" className="hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
