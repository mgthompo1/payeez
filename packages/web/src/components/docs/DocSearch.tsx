'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ChevronRight, Code2, CreditCard, Landmark, Users, Repeat, Receipt, Building2, Key, Shield, Webhook, Terminal, Package } from 'lucide-react'

interface SearchResult {
  section: string
  title: string
  description: string
  tabId: string
  icon: any
}

const DOC_SECTIONS: SearchResult[] = [
  { section: 'Quick Start', title: 'Getting Started', description: 'Install the SDK and accept payments in minutes', tabId: 'quickstart', icon: Terminal },
  { section: 'Quick Start', title: 'Install the SDK', description: 'npm install @atlas/sdk', tabId: 'quickstart', icon: Package },
  { section: 'Quick Start', title: 'Create a Payment Session', description: 'Create sessions from your backend with amount and currency', tabId: 'quickstart', icon: Code2 },
  { section: 'Quick Start', title: 'Mount the Payment Form', description: 'Use Atlas.mount() to render secure payment fields', tabId: 'quickstart', icon: Code2 },
  { section: 'Quick Start', title: 'Handle Webhooks', description: 'Listen for payment events like payment.captured, payment.failed', tabId: 'quickstart', icon: Webhook },
  { section: 'Quick Start', title: 'OpenAPI Specification', description: 'Download OpenAPI 3.0 spec for Postman or client generation', tabId: 'quickstart', icon: Code2 },

  { section: 'Authentication', title: 'API Keys', description: 'sk_test_ for sandbox, sk_live_ for production', tabId: 'authentication', icon: Key },
  { section: 'Authentication', title: 'Bearer Token', description: 'Authorization: Bearer sk_test_xxx header', tabId: 'authentication', icon: Key },
  { section: 'Authentication', title: 'Client Secret', description: 'Use client_secret on frontend for session confirmation', tabId: 'authentication', icon: Key },

  { section: 'Sessions', title: 'Create Session', description: 'POST /create-session - Create a payment session', tabId: 'sessions', icon: Code2 },
  { section: 'Sessions', title: 'Get Session', description: 'GET /get-session/:id - Retrieve session details', tabId: 'sessions', icon: Code2 },
  { section: 'Sessions', title: 'Session Status', description: 'Track session states: pending, processing, succeeded, canceled', tabId: 'sessions', icon: Code2 },

  { section: 'Payments', title: 'Confirm Payment', description: 'POST /confirm-payment/:id - Confirm and process a payment', tabId: 'payments', icon: CreditCard },
  { section: 'Payments', title: 'Capture Payment', description: 'POST /capture-payment/:id - Capture an authorized payment', tabId: 'payments', icon: CreditCard },
  { section: 'Payments', title: 'Refund Payment', description: 'POST /refund-payment/:id - Full or partial refund', tabId: 'payments', icon: CreditCard },
  { section: 'Payments', title: 'Manual Capture', description: 'Set capture_method: manual for authorize-then-capture flows', tabId: 'payments', icon: CreditCard },

  { section: 'Bank Accounts', title: 'Create Bank Account', description: 'POST /bank-accounts - Vault a bank account for ACH', tabId: 'bank-accounts', icon: Landmark },
  { section: 'Bank Accounts', title: 'ACH Payments', description: 'Accept US ACH, SEPA, BECS, and other bank rails', tabId: 'bank-accounts', icon: Landmark },
  { section: 'Bank Accounts', title: 'Microdeposit Verification', description: 'Verify bank accounts with micro-deposits', tabId: 'bank-accounts', icon: Landmark },
  { section: 'Bank Accounts', title: 'Bank Transfers', description: 'POST /bank-transfers - Initiate ACH debits/credits', tabId: 'bank-accounts', icon: Landmark },

  { section: 'Billing', title: 'Products', description: 'POST /products - Create products for recurring billing', tabId: 'billing', icon: Repeat },
  { section: 'Billing', title: 'Prices', description: 'POST /prices - Configure pricing with intervals', tabId: 'billing', icon: Repeat },
  { section: 'Billing', title: 'Subscriptions', description: 'POST /subscriptions - Create recurring subscriptions', tabId: 'billing', icon: Repeat },
  { section: 'Billing', title: 'Trials', description: 'Add trial_period_days to subscriptions', tabId: 'billing', icon: Repeat },
  { section: 'Billing', title: 'Metered Billing', description: 'Usage-based billing with usage records', tabId: 'billing', icon: Repeat },
  { section: 'Billing', title: 'Coupons', description: 'Create percent_off or amount_off discounts', tabId: 'billing', icon: Repeat },

  { section: 'Customers', title: 'Create Customer', description: 'POST /customers - Create a customer record', tabId: 'customers', icon: Users },
  { section: 'Customers', title: 'List Customers', description: 'GET /customers - Retrieve all customers', tabId: 'customers', icon: Users },
  { section: 'Customers', title: 'Update Customer', description: 'PATCH /customers/:id - Update customer details', tabId: 'customers', icon: Users },

  { section: 'Invoices', title: 'Create Invoice', description: 'POST /invoices - Create an invoice for a customer', tabId: 'invoices', icon: Receipt },
  { section: 'Invoices', title: 'Finalize Invoice', description: 'POST /invoices/:id/finalize - Send invoice to customer', tabId: 'invoices', icon: Receipt },
  { section: 'Invoices', title: 'Pay Invoice', description: 'POST /invoices/:id/pay - Collect payment on invoice', tabId: 'invoices', icon: Receipt },

  { section: 'Checkout', title: 'Checkout Sessions', description: 'Hosted checkout pages for conversion-optimized payments', tabId: 'checkout', icon: Building2 },
  { section: 'Checkout', title: 'Customer Portal', description: 'Self-service portal for subscriptions and billing', tabId: 'checkout', icon: Building2 },

  { section: '3D Secure', title: '3DS Authentication', description: 'POST /threeds-authenticate - Strong customer authentication', tabId: '3ds', icon: Shield },
  { section: '3D Secure', title: 'Frictionless Flow', description: 'Low-risk transactions authenticate silently', tabId: '3ds', icon: Shield },
  { section: '3D Secure', title: 'Challenge Flow', description: 'Handle 3DS challenges with iframe integration', tabId: '3ds', icon: Shield },
  { section: '3D Secure', title: 'Liability Shift', description: 'Transfer fraud liability to card issuer', tabId: '3ds', icon: Shield },

  { section: 'Webhooks', title: 'Create Webhook', description: 'POST /webhooks - Register a webhook endpoint', tabId: 'webhooks', icon: Webhook },
  { section: 'Webhooks', title: 'Webhook Events', description: 'payment.succeeded, payment.failed, refund.created, etc.', tabId: 'webhooks', icon: Webhook },
  { section: 'Webhooks', title: 'Verify Signatures', description: 'Validate webhook payloads with HMAC signatures', tabId: 'webhooks', icon: Webhook },

  { section: 'SDK', title: 'Atlas.mount()', description: 'Mount secure payment form elements', tabId: 'sdk', icon: Package },
  { section: 'SDK', title: 'Atlas.createCard()', description: 'Create standalone card element', tabId: 'sdk', icon: Package },
  { section: 'SDK', title: 'Appearance Config', description: 'Customize SDK theme, colors, and styles', tabId: 'sdk', icon: Package },
  { section: 'SDK', title: 'Apple Pay', description: 'Integrate Apple Pay with Atlas SDK', tabId: 'sdk', icon: Package },
  { section: 'SDK', title: 'Google Pay', description: 'Integrate Google Pay with Atlas SDK', tabId: 'sdk', icon: Package },
]

interface DocSearchProps {
  onNavigate: (tabId: string) => void
}

export function DocSearch({ onNavigate }: DocSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }

    const searchTerms = q.toLowerCase().split(' ').filter(Boolean)
    const matches = DOC_SECTIONS.filter(section => {
      const searchText = `${section.section} ${section.title} ${section.description}`.toLowerCase()
      return searchTerms.every(term => searchText.includes(term))
    })

    setResults(matches.slice(0, 10))
    setSelectedIndex(0)
  }, [])

  useEffect(() => {
    search(query)
  }, [query, search])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }

      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (result: SearchResult) => {
    onNavigate(result.tabId)
    setIsOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex])
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 w-full bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:bg-white/10 hover:border-cyan-500/30 transition-colors text-sm"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search docs...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-white/5 rounded border border-white/10">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          setIsOpen(false)
          setQuery('')
        }}
      />

      {/* Search Modal */}
      <div
        ref={containerRef}
        className="relative w-full max-w-xl mx-4 bg-charcoal border border-white/10 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white placeholder:text-slate-500 outline-none text-sm"
          />
          <button
            onClick={() => {
              setIsOpen(false)
              setQuery('')
            }}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">
              No results found for "{query}"
            </div>
          )}

          {results.map((result, idx) => {
            const Icon = result.icon
            return (
              <button
                key={`${result.tabId}-${result.title}`}
                onClick={() => handleSelect(result)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  idx === selectedIndex ? 'bg-cyan-500/10' : 'hover:bg-white/5'
                }`}
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  idx === selectedIndex ? 'bg-cyan-500/20' : 'bg-white/5'
                }`}>
                  <Icon className={`h-4 w-4 ${idx === selectedIndex ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${idx === selectedIndex ? 'text-cyan-400' : 'text-white'}`}>
                      {result.title}
                    </span>
                    <span className="text-xs text-slate-500">{result.section}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{result.description}</p>
                </div>
                <ChevronRight className={`h-4 w-4 ${idx === selectedIndex ? 'text-cyan-400' : 'text-slate-600'}`} />
              </button>
            )
          })}

          {!query && (
            <div className="px-4 py-6">
              <p className="text-xs text-slate-500 mb-3">Quick links</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Quick Start', tabId: 'quickstart', icon: Terminal },
                  { label: 'Authentication', tabId: 'authentication', icon: Key },
                  { label: 'Payments', tabId: 'payments', icon: CreditCard },
                  { label: 'Webhooks', tabId: 'webhooks', icon: Webhook },
                ].map((item) => (
                  <button
                    key={item.tabId}
                    onClick={() => {
                      onNavigate(item.tabId)
                      setIsOpen(false)
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm transition-colors"
                  >
                    <item.icon className="h-4 w-4 text-slate-400" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10">↵</kbd>
              to select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10">esc</kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  )
}
