import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Terminal,
  Globe,
  Database,
  Lock,
  GitBranch,
  Gauge,
  Cpu,
  Layers,
  ChevronRight
} from 'lucide-react'

const processors = ['Stripe', 'Adyen', 'Windcave', 'Authorize.net', 'Chase', 'Nuvei', 'dLocal', 'Braintree', 'Checkout.com', 'Airwallex']

const pillars = [
  {
    title: 'Routing Engine',
    description: 'Weighted splits, conditional rules, and adaptive retries across every PSP.',
    icon: GitBranch,
    className: "md:col-span-2 md:row-span-1"
  },
  {
    title: 'Resilience Layer',
    description: 'Circuit breakers, multi-region endpoints, and emergency direct-PSP routing.',
    icon: Zap,
    className: "md:col-span-1 md:row-span-1"
  },
  {
    title: 'Atlas Vault',
    description: 'PCI Level 1 tokenization keeps card data out of scope, always. Zero-Trust architecture by default.',
    icon: ShieldCheck,
    className: "md:col-span-1 md:row-span-2"
  },
  {
    title: 'Unified Events',
    description: 'Normalized webhooks and consistent error taxonomy across providers.',
    icon: Activity,
    className: "md:col-span-2 md:row-span-1"
  },
  {
    title: 'Latency Control',
    description: 'Live processor health, routing telemetry, and SLA-aware decisions.',
    icon: Gauge,
    className: "md:col-span-1 md:row-span-1"
  },
  {
    title: 'Programmable Rules',
    description: 'Route by currency, amount, BIN, or region with a single API.',
    icon: Cpu,
    className: "md:col-span-2 md:row-span-1"
  },
]

const steps = [
  {
    title: 'Create a session',
    description: 'Your server defines amount, currency, and allowed methods. We return a client secret.',
    icon: Terminal,
  },
  {
    title: 'Mount the Secure Frame',
    description: 'Secure fields render in an isolated iframe. Atlas tokenizes, you get a token.',
    icon: Lock,
  },
  {
    title: 'Route the payment',
    description: 'Rules select the best PSP, retries kick in, and you get a unified event.',
    icon: Zap,
  },
]

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-obsidian text-[#EDEDED] font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="bg-noise" />
      <div className="light-leak opacity-50" />

      {/* Minimal Nav */}
      <nav className="fixed w-full z-50 top-0 border-b border-white/5 bg-obsidian/80 backdrop-blur-xl">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5z"/>
            </svg>
            <span className="font-mono text-sm tracking-tight text-white/80">Atlas</span>
          </div>
          <div className="hidden md:flex gap-8 text-xs font-medium text-white/50 tracking-wide uppercase">
            <Link href="/dashboard/docs" className="hover:text-cyan-400 transition">Docs</Link>
            <Link href="/pricing" className="hover:text-cyan-400 transition">Pricing</Link>
            <Link href="/security" className="hover:text-cyan-400 transition">Security</Link>
            <Link href="/status" className="hover:text-cyan-400 transition">Status</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-xs font-mono text-white/60 hover:text-white transition">
              Sign In
            </Link>
            <Link href="/signup" className="text-xs font-mono text-white bg-cyan-600/10 border border-cyan-500/20 hover:bg-cyan-600 hover:text-white px-4 py-1.5 rounded transition duration-300">
              Start Sandbox
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="relative pt-40 pb-32 overflow-hidden z-10">
          <div className="max-w-screen-xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
            
            {/* Left: Typography */}
            <div className="relative z-20">
              <div className="inline-block mb-6 px-3 py-1 border border-cyan-500/20 rounded-full bg-cyan-500/5 backdrop-blur fade-up">
                <span className="text-[10px] font-mono text-cyan-300 tracking-widest uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/>
                  System Operational
                </span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-medium tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-cyan-200 mb-8 leading-[0.95] fade-up fade-up-1">
                The Payment Vault <br />
                <span className="text-white/40">for</span> Global Scale.
              </h1>
              
              <p className="text-lg text-white/60 mb-12 max-w-md font-light leading-relaxed fade-up fade-up-2">
                Programmable financial infrastructure. Isolate sensitive data, reduce compliance scope, and route payments with a single, hardened API.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 fade-up fade-up-3">
                <Button asChild className="h-12 px-8 border-0 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)] text-sm font-medium rounded-full transition-all duration-300">
                  <Link href="/signup">Start Integration</Link>
                </Button>
                <div className="h-12 px-8 flex items-center gap-3 text-white/60 text-sm font-mono border-l border-white/10 ml-2 pl-6">
                  <span className="text-cyan-300">npm</span> install @atlas/sdk
                  <button className="hover:text-white transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: 3D Visualization */}
            <div className="perspective-container h-[500px] flex items-center justify-center relative fade-up fade-up-2">
              {/* Decorative Gradients behind */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 blur-[100px] opacity-40" />
              
              {/* The Floating Vault Card */}
              <div className="vault-card w-full max-w-md bg-[#0A0A0A]/90 backdrop-blur-xl rounded-xl overflow-hidden relative border border-white/10 group hover:border-cyan-500/50 hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)] transition-all duration-500">
                {/* Card Header */}
                <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-white/5">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    ENCRYPTED
                  </div>
                </div>
                
                {/* Card Body */}
                <div className="p-6 space-y-6">
                  {/* Code Block */}
                  <div className="font-mono text-xs space-y-2">
                    <div className="flex text-white/40"><span className="w-6 select-none">01</span> <span className="text-cyan-400">const</span> <span className="text-white">vault</span> = <span className="text-cyan-400">new</span> Atlas.<span className="text-yellow-200">Vault</span>();</div>
                    <div className="flex text-white/40"><span className="w-6 select-none">02</span></div>
                    <div className="flex text-white/40"><span className="w-6 select-none">03</span> <span className="text-white/60">{"// Tokenizing sensitive payload"}</span></div>
                    <div className="flex text-white/40"><span className="w-6 select-none">04</span> <span className="text-cyan-400">const</span> <span className="text-white">token</span> = <span className="text-cyan-400">await</span> vault.<span className="text-blue-400">encrypt</span>{'{'}</div>
                    <div className="flex text-white/40"><span className="w-6 select-none">05</span>   <span className="text-white">pan:</span> <span className="text-emerald-400">"4242-4242-4242-4242"</span>,</div>
                    <div className="flex text-white/40"><span className="w-6 select-none">06</span>   <span className="text-white">cvc:</span> <span className="text-emerald-400">"***"</span></div>
                    <div className="flex text-white/40"><span className="w-6 select-none">07</span> {'}'});</div>
                  </div>

                  {/* Visual Representation of Tokenization */}
                  <div className="h-24 bg-black/80 rounded border border-white/5 relative overflow-hidden flex items-center justify-center group-hover:border-cyan-500/30 transition duration-500">
                    <div className="absolute inset-0 bg-grid-tech opacity-20" />
                    <div className="absolute w-full h-1 bg-cyan-500/20 top-0 animate-scan" />
                    
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-6 bg-white/10 rounded border border-white/10" />
                      <ArrowRight className="w-4 h-4 text-white/20" />
                      <div className="px-3 py-1 bg-cyan-500/10 rounded border border-cyan-500/20 text-[10px] font-mono text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.1)]">tok_19x...2b</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Processors Marquee */}
        <section className="border-y border-white/5 bg-white/[0.02]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-12 gap-y-6 px-6 py-12">
            {processors.map((name) => (
              <span key={name} className="uppercase tracking-[0.2em] text-[10px] font-medium text-white/30 hover:text-cyan-400/50 transition duration-300 cursor-default">
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-32 relative bg-charcoal">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="text-3xl font-medium tracking-tight text-white mb-16">Engineered for security.</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pillars.map((pillar, i) => (
                <div key={i} className={`group rounded-2xl border border-white/5 bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-cyan-500/30 hover:shadow-[0_0_30px_-10px_rgba(6,182,212,0.15)] transition-all duration-500 ${pillar.className || ''}`}>
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_15px_-3px_rgba(34,211,238,0.4)] transition duration-500">
                    <pillar.icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2 group-hover:text-cyan-100 transition">{pillar.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{pillar.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works (Steps) */}
        <section className="py-24 border-t border-white/5">
           <div className="max-w-screen-xl mx-auto px-6">
             <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
               <div className="max-w-xl">
                 <h2 className="text-3xl font-medium tracking-tight text-white mb-4">Three steps, zero risk.</h2>
                 <p className="text-white/60">Atlas captures the data in a PCI-compliant vault, handles orchestration, and you own the outcome.</p>
               </div>
               <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 hover:text-cyan-400">
                 View Integration Guide
               </Button>
             </div>

             <div className="grid md:grid-cols-3 gap-8">
                {steps.map((step, index) => (
                  <div key={index} className="relative pl-8 border-l border-white/10">
                    <span className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-obsidian border border-cyan-500/50" />
                    <div className="mb-4">
                      <step.icon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-white/50">{step.description}</p>
                  </div>
                ))}
             </div>
           </div>
        </section>

        {/* API Surface */}
        <section className="py-24 border-t border-white/5 bg-white/[0.02]">
          <div className="max-w-screen-xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-medium tracking-tight text-white mb-6">Predictable responses across every PSP.</h2>
              <p className="text-lg text-white/60 mb-8 leading-relaxed">
                Standardize payments without giving up control. Every call returns the same schema, including routing metadata and processor outcomes.
              </p>
              <ul className="space-y-3">
                  {[
                    'Idempotent create-session with automatic dedupe',
                    'Signed webhooks with strict replay protection',
                    'Normalized errors and decline categories',
                    'Typed SDK with payments, 3DS, and network tokens',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-white/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                      <span>{item}</span>
                    </li>
                  ))}
              </ul>
            </div>
            
            <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0A0A0A] shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5 text-xs text-white/40">
                <span className="font-mono text-cyan-300">confirm-payment.ts</span>
                <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400 border border-emerald-500/20">200 OK</span>
              </div>
              <pre className="p-6 text-xs sm:text-sm font-mono text-white/70 overflow-x-auto bg-[#050505]">
{`{
  "id": "pay_2xK9mN7vQ3",
  "status": "captured",
  "amount": 4990,
  "currency": "NZD",
  "psp": "windcave",
  "card": {
    "brand": "visa",
    "last4": "4242"
  },
  "routing": {
    "attempts": 1,
    "selected_psp": "windcave",
    "selection_reason": "weighted_random"
  }
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 text-center">
          <div className="max-w-2xl mx-auto px-6">
            <h2 className="text-4xl font-medium tracking-tight text-white mb-6">Start routing payments in minutes.</h2>
            <p className="text-white/50 mb-10">Launch with a sandbox today, go live when your routing rules are ready.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-full px-8 h-12">
                <Link href="/signup">Create Sandbox</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/10 text-white hover:bg-white/5 rounded-full px-8 h-12">
                <Link href="/contact">Talk to Atlas</Link>
              </Button>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 py-12 bg-obsidian">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5z"/>
                </svg>
                <span className="text-sm tracking-[0.3em] uppercase text-white/80">Atlas</span>
              </div>
              <p className="text-sm text-white/60">
                Smart payment routing for teams who want control over every transaction.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Product</h4>
              <div className="space-y-2 text-sm text-white/60">
                <Link href="/dashboard/docs" className="hover:text-cyan-400 transition-colors block">Documentation</Link>
                <Link href="/pricing" className="hover:text-cyan-400 transition-colors block">Pricing</Link>
                <Link href="/changelog" className="hover:text-cyan-400 transition-colors block">Changelog</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Company</h4>
              <div className="space-y-2 text-sm text-white/60">
                <Link href="/about" className="hover:text-cyan-400 transition-colors block">About</Link>
                <Link href="/blog" className="hover:text-cyan-400 transition-colors block">Blog</Link>
                <Link href="/careers" className="hover:text-cyan-400 transition-colors block">Careers</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Trust</h4>
              <div className="space-y-2 text-sm text-white/60">
                <Link href="/security" className="hover:text-cyan-400 transition-colors block">Security</Link>
                <Link href="/privacy" className="hover:text-cyan-400 transition-colors block">Privacy</Link>
                <Link href="/terms" className="hover:text-cyan-400 transition-colors block">Terms</Link>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 px-6 pt-6 text-xs text-white/40 md:flex-row">
            <span>© 2026 Atlas. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="https://twitter.com" className="hover:text-cyan-400 transition-colors">X</Link>
              <Link href="https://github.com" className="hover:text-cyan-400 transition-colors">GitHub</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}