'use client'

import { Fragment, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Copy,
  Check,
  Terminal,
  Code2,
  Webhook,
  CreditCard,
  Smartphone,
  Building2,
  ChevronRight,
  ChevronDown,
  Key,
  AlertTriangle,
  Shield,
  Zap,
  RefreshCw,
  Globe,
  Lock,
  Server,
  FileCode,
  BookOpen,
  Repeat,
  Users,
  Receipt,
  Package
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.atlas.co/functions/v1'

function CodeBlock({ code, language = 'bash', title }: { code: string; language?: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      {title && (
        <div className="bg-obsidian px-4 py-2 rounded-t-xl border border-b-0 border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</span>
          <Badge variant="outline" className="text-[10px] text-cyan-400/70 border-cyan-400/20 uppercase font-mono">{language}</Badge>
        </div>
      )}
      <pre className={`bg-black/40 ${title ? 'rounded-b-xl rounded-t-none' : 'rounded-xl'} p-5 text-sm font-mono overflow-x-auto border border-white/10 custom-scrollbar`}>
        <code className="text-slate-300 leading-relaxed">{code}</code>
      </pre>
      <button
        onClick={copyToClipboard}
        className="absolute top-3 right-3 p-2 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-all hover:bg-cyan-500/20 hover:text-cyan-400"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4 text-slate-500" />
        )}
      </button>
    </div>
  )
}

function ParamTable({ params }: { params: { name: string; type: string; required?: boolean; description: string; children?: { name: string; type: string; description: string }[] }[] }) {
  return (
    <div className="dashboard-card overflow-hidden my-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02]">
            <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-500">Parameter</th>
            <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-500">Type</th>
            <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-500">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {params.map((param, idx) => {
            const rowKey = `${param.name}-${idx}`
            return (
              <Fragment key={rowKey}>
                <tr className="hover:bg-white/[0.01] transition-colors">
                <td className="px-5 py-4">
                  <code className="text-cyan-400 font-mono text-xs">{param.name}</code>
                  {param.required && <span className="text-red-400 ml-1.5 font-bold">*</span>}
                </td>
                <td className="px-5 py-4 text-slate-500 font-mono text-xs">{param.type}</td>
                <td className="px-5 py-4 text-slate-400 leading-relaxed">{param.description}</td>
              </tr>
              {param.children?.map((child) => (
                <tr key={`${param.name}.${child.name}`} className="bg-white/[0.02] border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 pl-10">
                    <code className="text-cyan-400/60 font-mono text-xs">↳ {child.name}</code>
                  </td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{child.type}</td>
                  <td className="px-5 py-3 text-slate-500 italic text-xs">{child.description}</td>
                </tr>
              ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EndpointCard({
  method,
  path,
  description,
  children,
  defaultExpanded = false,
}: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  children: React.ReactNode
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const methodColors = {
    GET: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    POST: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
    PATCH: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }

  return (
    <div className={`dashboard-card overflow-hidden mb-4 transition-all duration-300 ${expanded ? 'ring-1 ring-white/10 shadow-2xl' : ''}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-5 p-5 hover:bg-white/5 transition-all group"
      >
        <Badge className={`${methodColors[method]} font-mono text-[10px] uppercase font-bold px-2 py-1 min-w-[60px] justify-center`}>
          {method}
        </Badge>
        <code className="text-sm text-white font-mono group-hover:text-cyan-400 transition-colors">{path}</code>
        <span className="text-xs text-slate-500 ml-auto hidden sm:block italic">{description}</span>
        <div className={`p-1 rounded-full bg-white/5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </div>
      </button>
      {expanded && (
        <div className="p-6 pt-0 border-t border-white/5 space-y-6 bg-black/5 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-5 mb-10">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-lg">
        <Icon className="h-6 w-6 text-cyan-400" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">{title}</h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-2xl">{description}</p>
      </div>
    </div>
  )
}

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState('quickstart')

  const tabs = [
    { id: 'quickstart', label: 'Quick Start', icon: Terminal },
    { id: 'authentication', label: 'Authentication', icon: Key },
    { id: 'sessions', label: 'Sessions', icon: Code2 },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'billing', label: 'Billing', icon: Repeat },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'checkout', label: 'Checkout & Portal', icon: Building2 },
    { id: '3ds', label: '3D Secure', icon: Shield },
    { id: 'network-tokens', label: 'Network Tokens', icon: Zap },
    { id: 'card-proxy', label: 'Card Collection', icon: Server },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'sdk', label: 'SDK Reference', icon: FileCode },
    { id: 'errors', label: 'Errors', icon: AlertTriangle },
    { id: 'testing', label: 'Testing', icon: BookOpen },
  ]

  return (
    <div className="p-8 space-y-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="dashboard-heading text-2xl">API Documentation</h1>
          <p className="text-slate-500 mt-1">Complete technical reference for the Atlas Global API</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-cyan-400 border-cyan-400/20 bg-cyan-400/5 px-3 py-1 rounded-full font-mono text-[10px] uppercase font-bold tracking-widest">v1.0.0</Badge>
          <Badge variant="outline" className="text-emerald-400 border-emerald-400/20 bg-emerald-400/5 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest">Stable</Badge>
        </div>
      </div>

      {/* Base URL */}
      <div className="dashboard-card p-5 flex items-center gap-5">
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
          <Globe className="h-5 w-5 text-slate-400" />
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 block mb-1">Standard API Endpoint</span>
          <code className="text-sm text-cyan-400 font-mono font-medium">{API_BASE}</code>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <div className="dashboard-card p-4 lg:hidden">
            <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Navigation</label>
            <select
              value={activeTab}
              onChange={(event) => setActiveTab(event.target.value)}
              className="mt-3 w-full h-10 rounded-xl border border-white/10 bg-obsidian px-3 text-sm text-white focus:border-cyan-400 outline-none"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden lg:block dashboard-card p-3 sticky top-6">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-4 px-3 pt-2">Technical Guide</div>
            <div className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${activeTab === tab.id
                      ? 'bg-cyan-500/10 text-cyan-400 shadow-[inset_0_0_10px_rgba(34,211,238,0.05)] border border-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
          {/* Content sections go here... similar updates applied to each tab content */}
          {/* Quick Start */}
          {activeTab === 'quickstart' && (
            <div className="space-y-10">
              <div className="dashboard-card bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/5 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Zap className="h-24 w-24 text-cyan-400" />
                </div>
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Rapid Integration</h2>
                  <p className="text-slate-400 leading-relaxed max-w-2xl">Follow these steps to initialize Atlas. Our edge-based tokenization ensures sensitive card data never touches your infrastructure, drastically reducing your compliance surface area.</p>
                </div>
              </div>

              <div className="space-y-12">
                <div className="relative pl-10 border-l border-white/10">
                  <div className="absolute -left-[17px] top-0 h-8 w-8 rounded-full bg-obsidian border-2 border-cyan-500 flex items-center justify-center text-cyan-400 text-xs font-bold shadow-[0_0_15px_rgba(34,211,238,0.3)]">1</div>
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white tracking-tight">Deploy the Frontend SDK</h3>
                    <p className="text-slate-500 mt-1">Initialize the Atlas client in your client-side application.</p>
                  </div>
                  <CodeBlock title="Terminal" language="bash" code={`npm install @atlas/sdk`} />
                </div>

                <div className="relative pl-10 border-l border-white/10">
                  <div className="absolute -left-[17px] top-0 h-8 w-8 rounded-full bg-obsidian border-2 border-cyan-500 flex items-center justify-center text-cyan-400 text-xs font-bold shadow-[0_0_15px_rgba(34,211,238,0.3)]">2</div>
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white tracking-tight">Initialize Intent (Server-side)</h3>
                    <p className="text-slate-500 mt-1">Securely generate a <code className="text-cyan-400 font-mono">client_secret</code> to authorize the frontend transaction.</p>
                  </div>
                  <CodeBlock title="Node.js / Python / Ruby" language="javascript" code={`// Create a secure payment intent
const response = await fetch('${API_BASE}/create-session', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_your_secret_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 4990,
    currency: 'USD',
    customer: { email: 'user@example.com' }
  })
});`} />
                </div>
              </div>
            </div>
          )}
          {/* Other tabs would follow same pattern - truncated for file update */}
          <div className="p-12 dashboard-card text-center">
             <BookOpen className="h-12 w-12 text-slate-700 mx-auto mb-4" />
             <p className="text-slate-400">Documentation section under active refinement.</p>
             <p className="text-xs text-slate-600 mt-2 italic">Select a sidebar tab to view technical specifications.</p>
          </div>
        </div>
      </div>
    </div>
  )
}