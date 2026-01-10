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
        <div className="bg-[#1a1a1a] px-4 py-2 rounded-t-xl border border-b-0 border-white/10 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">{title}</span>
          <Badge variant="outline" className="text-[10px] text-gray-500 border-white/10">{language}</Badge>
        </div>
      )}
      <pre className={`bg-[#0a0a0a] ${title ? 'rounded-b-xl rounded-t-none' : 'rounded-xl'} p-4 text-sm font-mono overflow-x-auto border border-white/10`}>
        <code className="text-gray-300">{code}</code>
      </pre>
      <button
        onClick={copyToClipboard}
        className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4 text-gray-400" />
        )}
      </button>
    </div>
  )
}

function ParamTable({ params }: { params: { name: string; type: string; required?: boolean; description: string; children?: { name: string; type: string; description: string }[] }[] }) {
  return (
    <div className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Parameter</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((param, idx) => {
            const rowKey = `${param.name}-${idx}`
            return (
              <Fragment key={rowKey}>
                <tr className={idx !== params.length - 1 ? 'border-b border-white/5' : ''}>
                <td className="px-4 py-3">
                  <code className="text-[#19d1c3]">{param.name}</code>
                  {param.required && <span className="text-red-400 ml-1">*</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">{param.type}</td>
                <td className="px-4 py-3 text-gray-400">{param.description}</td>
              </tr>
              {param.children?.map((child) => (
                <tr key={`${param.name}.${child.name}`} className="border-b border-white/5 bg-white/[0.02]">
                  <td className="px-4 py-2 pl-8">
                    <code className="text-[#19d1c3]/70">↳ {child.name}</code>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{child.type}</td>
                  <td className="px-4 py-2 text-gray-400">{child.description}</td>
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
    POST: 'bg-green-500/10 text-green-400 border-green-500/20',
    PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
    PATCH: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }

  return (
    <div className="rounded-xl bg-[#111] border border-white/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
      >
        <Badge className={`${methodColors[method]} font-mono text-xs px-2 py-1 min-w-[60px]`}>
          {method}
        </Badge>
        <code className="text-sm text-white font-mono">{path}</code>
        <span className="text-sm text-gray-500 ml-auto hidden sm:block">{description}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {expanded && (
        <div className="p-4 pt-0 border-t border-white/5 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#19d1c3]/20 to-[#c8ff5a]/20 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-[#19d1c3]" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Documentation</h1>
          <p className="text-gray-500 mt-1">Complete reference for the Atlas API</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[#19d1c3] border-[#19d1c3]/30">v1.0</Badge>
          <Badge variant="outline" className="text-green-400 border-green-500/30">Stable</Badge>
        </div>
      </div>

      {/* Base URL */}
      <div className="rounded-xl bg-[#111] border border-white/10 p-4 flex items-center gap-4">
        <Globe className="h-5 w-5 text-gray-500" />
        <div>
          <span className="text-xs text-gray-500 block">Base URL</span>
          <code className="text-sm text-white font-mono">{API_BASE}</code>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl bg-[#0f1621]/70 border border-white/10 p-4 lg:hidden">
            <label className="text-xs uppercase tracking-[0.3em] text-[#8ba3b7]">Section</label>
            <select
              value={activeTab}
              onChange={(event) => setActiveTab(event.target.value)}
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#0b111a] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#19d1c3]/60"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden lg:block rounded-2xl border border-white/10 bg-[#0f1621]/70 p-4 sticky top-6">
            <div className="text-xs uppercase tracking-[0.3em] text-[#8ba3b7] mb-3">Documentation</div>
            <div className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${activeTab === tab.id
                      ? 'bg-[#19d1c3]/10 text-[#19d1c3] border border-[#19d1c3]/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Start */}
          {activeTab === 'quickstart' && (
            <div className="space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-[#19d1c3]/10 to-[#c8ff5a]/10 border border-[#19d1c3]/20 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Accept payments in minutes</h2>
            <p className="text-gray-400 text-sm">Follow these steps to integrate Atlas into your application. Card data never touches your servers - we handle PCI compliance for you.</p>
          </div>

          <div className="grid gap-6">
            {/* Step 1 */}
            <div className="rounded-xl bg-[#111] border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-[#19d1c3]/10 flex items-center justify-center text-[#19d1c3] font-bold text-sm">1</div>
                <h3 className="font-semibold text-white">Install the SDK</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Add the Atlas SDK to your frontend application.
              </p>
              <CodeBlock title="Terminal" language="bash" code={`npm install @atlas/sdk
# or
yarn add @atlas/sdk
# or
pnpm add @atlas/sdk`}
              />
            </div>

            {/* Step 2 */}
            <div className="rounded-xl bg-[#111] border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-[#19d1c3]/10 flex items-center justify-center text-[#19d1c3] font-bold text-sm">2</div>
                <h3 className="font-semibold text-white">Create a Payment Session (Server-side)</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Create a session from your backend. This returns a <code className="text-[#19d1c3]">client_secret</code> to pass to your frontend.
              </p>
              <CodeBlock title="Server - Node.js" language="javascript" code={`const response = await fetch('${API_BASE}/create-session', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_your_secret_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 4990,           // Amount in cents ($49.90)
    currency: 'USD',
    customer: {
      email: 'customer@example.com',
      name: 'John Doe'
    },
    metadata: {
      order_id: 'order_12345'
    }
  })
});

const session = await response.json();
// Return session.id and session.client_secret to your frontend`}
              />
            </div>

            {/* Step 3 */}
            <div className="rounded-xl bg-[#111] border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-[#c8ff5a]/10 flex items-center justify-center text-[#c8ff5a] font-bold text-sm">3</div>
                <h3 className="font-semibold text-white">Mount the Payment Form (Client-side)</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Use the SDK to render secure payment fields. Card data is tokenized client-side and never touches your servers.
              </p>
              <CodeBlock title="Client - React" language="tsx" code={`import { Atlas } from '@atlas/sdk';

function CheckoutPage({ sessionId, clientSecret }) {
  useEffect(() => {
    Atlas.mount({
      sessionId,
      clientSecret,
      elementId: 'payment-form',
      appearance: {
        theme: 'dark',
        variables: {
          colorPrimary: '#8b5cf6',
          borderRadius: '8px'
        }
      },
      onReady: () => {
        console.log('Payment form ready');
      },
      onSuccess: (payment) => {
        console.log('Payment successful:', payment.id);
        window.location.href = '/success?payment=' + payment.id;
      },
      onError: (error) => {
        console.error('Payment failed:', error.message);
        setError(error.message);
      }
    });

    return () => Atlas.unmount();
  }, [sessionId, clientSecret]);

  return <div id="payment-form" />;
}`}
              />
            </div>

            {/* Step 4 */}
            <div className="rounded-xl bg-[#111] border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 font-bold text-sm">4</div>
                <h3 className="font-semibold text-white">Handle Webhooks (Server-side)</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Set up webhook handlers to receive payment events. Always verify webhook signatures.
              </p>
              <CodeBlock title="Server - Node.js (Express)" language="javascript" code={`import crypto from 'crypto';

app.post('/webhooks/atlas', express.raw({ type: 'application/json' }), (req, res) => {
  const signatureHeader = req.headers['x-atlas-signature'];
  const secret = process.env.ATLAS_WEBHOOK_SECRET;

  if (!signatureHeader || !secret) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const parts = signatureHeader.split(',');
  const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1];
  const signature = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

  const payload = req.body.toString('utf8');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + payload)
    .digest('hex');

  const isValid = signature && crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(payload);

  switch (event.type) {
    case 'payment.captured':
      await fulfillOrder(event.data.metadata.order_id);
      break;
    case 'payment.failed':
      await notifyCustomer(event.data.customer.email);
      break;
    case 'refund.succeeded':
      await updateInventory(event.data.metadata.order_id);
      break;
  }

  res.json({ received: true });
});`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Authentication */}
      {activeTab === 'authentication' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Key}
            title="Authentication"
            description="Secure your API requests with API keys"
          />

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">API Keys</h3>
            <p className="text-sm text-gray-400">
              Atlas uses API keys to authenticate requests. You can view and manage your API keys in the{' '}
              <a href="/dashboard/api-keys" className="text-[#19d1c3] hover:underline">Dashboard</a>.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Test</Badge>
                  <code className="text-sm text-gray-400">sk_test_...</code>
                </div>
                <p className="text-xs text-gray-500">Use for development. No real charges.</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Live</Badge>
                  <code className="text-sm text-gray-400">sk_live_...</code>
                </div>
                <p className="text-xs text-gray-500">Use in production. Real charges processed.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Making Authenticated Requests</h3>
            <p className="text-sm text-gray-400">
              Include your API key in the <code className="text-[#19d1c3]">Authorization</code> header as a Bearer token.
            </p>
            <CodeBlock title="Example Request" language="bash" code={`curl ${API_BASE}/create-session \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json"`}
            />
          </div>

          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-400">Keep your secret key secure</h4>
              <p className="text-sm text-gray-400 mt-1">
                Never expose your secret key in client-side code, public repositories, or client-side JavaScript.
                Use environment variables and server-side code to make API calls.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Idempotency</h3>
            <p className="text-sm text-gray-400">
              Use idempotency keys to safely retry requests without accidentally performing the same operation twice.
              Include the <code className="text-[#19d1c3]">Idempotency-Key</code> header with a unique value.
            </p>
            <CodeBlock title="Idempotent Request" language="bash" code={`curl -X POST ${API_BASE}/create-session \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Idempotency-Key: order_12345_payment" \
  -H "Content-Type: application/json" \
  -d '{"amount": 4990, "currency": "USD"}'`}
            />
            <p className="text-xs text-gray-500">
              Idempotency keys expire after 24 hours. We recommend using order IDs or UUIDs.
            </p>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Rate Limits</h3>
            <p className="text-sm text-gray-400">
              The API is rate limited to ensure fair usage. Current limits:
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white/5 text-center">
                <div className="text-2xl font-bold text-white">1,000</div>
                <div className="text-xs text-gray-500">requests/minute</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5 text-center">
                <div className="text-2xl font-bold text-white">100,000</div>
                <div className="text-xs text-gray-500">requests/day</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5 text-center">
                <div className="text-2xl font-bold text-white">50</div>
                <div className="text-xs text-gray-500">concurrent requests</div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Rate limit headers are included in every response: <code className="text-[#19d1c3]">X-RateLimit-Limit</code>,
              <code className="text-[#19d1c3] ml-1">X-RateLimit-Remaining</code>, <code className="text-[#19d1c3] ml-1">X-RateLimit-Reset</code>
            </p>
          </div>
        </div>
      )}

      {/* Sessions */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Code2}
            title="Payment Sessions"
            description="Create and manage payment sessions"
          />

          <div className="rounded-xl bg-[#111] border border-white/10 p-6">
            <p className="text-sm text-gray-400">
              A Payment Session represents a customer's payment intent. Create a session server-side,
              then use the <code className="text-[#19d1c3]">client_secret</code> to mount the payment form on your frontend.
            </p>
          </div>

          <EndpointCard method="POST" path="/create-session" description="Create a payment session" defaultExpanded>
            <div className="space-y-6 mt-4">
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Request Body</h4>
                <ParamTable params={[ { name: 'amount', type: 'integer', required: true, description: 'Amount in smallest currency unit (cents for USD)' }, { name: 'currency', type: 'string', required: true, description: 'Three-letter ISO 4217 currency code (USD, EUR, GBP)' }, { name: 'external_id', type: 'string', description: 'Your order or cart reference (idempotent if reused)' }, { name: 'capture_method', type: 'string', description: '"automatic" (default) or "manual" for auth-only' }, { name: 'customer', type: 'object', description: 'Customer information', children: [ { name: 'email', type: 'string', description: 'Customer email address' }, { name: 'name', type: 'string', description: 'Customer full name' }, ] }, { name: 'success_url', type: 'string', description: 'Redirect after successful payment' }, { name: 'cancel_url', type: 'string', description: 'Redirect after cancellation' }, { name: 'payment_method_types', type: 'array', description: 'Allowed payment methods: ["card", "apple_pay", "google_pay", "bank_account"]' }, { name: 'metadata', type: 'object', description: 'Custom key-value pairs' }, ]} />
              </div>

              <div>
                <h4 className="text-sm font-medium text-white mb-3">Example Request</h4>
                <CodeBlock language="bash" code={`curl -X POST ${API_BASE}/create-session \
  -H "Authorization: Bearer sk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 4990,
    "currency": "USD",
    "external_id": "order_12345",
    "capture_method": "automatic",
    "customer": {
      "email": "customer@example.com",
      "name": "John Doe"
    },
    "metadata": {
      "plan": "premium"
    },
    "success_url": "https://yoursite.com/checkout/success",
    "cancel_url": "https://yoursite.com/checkout/cancel"
  }'`}
                />
              </div>

              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response</h4>
                <CodeBlock language="json" code={`{
  "id": "sess_2xK9mN7vQ3pL8wYz",
  "client_secret": "cs_2xK9mN7vQ3pL8wYz",
  "status": "requires_payment_method",
  "amount": 4990,
  "currency": "USD",
  "external_id": "order_12345",
  "fallback_url": null,
  "created_at": "2024-01-15T10:30:00Z"
}`}
                />
              </div>
            </div>
          </EndpointCard>

          <EndpointCard method="GET" path="/get-session-config/:id" description="Retrieve SDK configuration (client secret)">
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Path Parameters</h4>
                <ParamTable params={[ { name: 'id', type: 'string', required: true, description: 'The session ID (sess_xxx)' }, ]} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response</h4>
                <p className="text-sm text-gray-400">Returns the session configuration used by the SDK (payment methods, keys, and feature flags).</p>
              </div>
            </div>
          </EndpointCard>
        </div>
      )}

      {/* Payments */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <SectionHeader
            icon={CreditCard}
            title="Payments"
            description="Capture, refund, and manage payments"
          />

          <div className="rounded-xl bg-[#111] border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Transaction types</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Purchase</div>
                <div className="text-sm text-white mt-1">Use <code className="text-[#19d1c3]">POST /confirm-payment/:id</code> with automatic capture (default).</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Authorize</div>
                <div className="text-sm text-white mt-1">Set <code className="text-[#19d1c3]">capture_method: "manual"</code> when creating the session.</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Capture</div>
                <div className="text-sm text-white mt-1">Call <code className="text-[#19d1c3]">POST /capture-payment/:id</code> for full or partial capture.</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Refund</div>
                <div className="text-sm text-white mt-1">Call <code className="text-[#19d1c3]">POST /refund-payment/:id</code> with optional <code className="text-[#19d1c3]">amount</code> for partial refunds.</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-gray-500">Tokenize</div>
                <div className="text-sm text-white mt-1">
                  Tokenization happens via the SDK or the <code className="text-[#19d1c3]">/card-collection-proxy</code> endpoint for server-side flows.
                </div>
              </div>
            </div>
          </div>

          <EndpointCard method="POST" path="/confirm-payment/:id" description="Confirm a payment">
            <div className="space-y-4 mt-4">
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-sm text-blue-400">
                  This endpoint is called automatically by the SDK. You typically don't need to call it directly
                  unless building a custom integration.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Request Body</h4>
                <ParamTable params={[ { name: 'payment_method_type', type: 'string', required: true, description: '"card", "apple_pay", "google_pay", or "bank_account"' }, { name: 'token_id', type: 'string', description: 'Token ID from card or bank element' }, { name: 'token_provider', type: 'string', description: '"atlas" or "vgs"' }, { name: 'psp', type: 'string', description: 'Force a specific PSP for the initial attempt' }, { name: 'routing_profile_id', type: 'string', description: 'Use a specific routing profile for PSP selection' }, { name: 'apple_pay_token', type: 'string', description: 'Apple Pay token payload (stringified)' }, { name: 'google_pay_token', type: 'string', description: 'Google Pay token payload (stringified)' }, { name: 'vgs_data', type: 'object', description: 'Required when token_provider is vgs', children: [ { name: 'card_number', type: 'string', description: 'VGS card number alias' }, { name: 'card_expiry', type: 'string', description: 'VGS card expiry alias' }, { name: 'card_cvc', type: 'string', description: 'VGS card CVC alias' }, ]}, { name: 'bank_account', type: 'object', description: 'Bank account details (for ACH)', children: [ { name: 'account_holder_name', type: 'string', description: 'Account holder name' }, { name: 'account_type', type: 'string', description: '"checking" or "savings"' }, ]}, ]} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response</h4>
                <CodeBlock language="json" code={`{
  "id": "pay_8xM2nQ4vR7kL9pYz",
  "session_id": "sess_2xK9mN7vQ3pL8wYz",
  "amount": 4990,
  "currency": "USD",
  "status": "captured",
  "payment_method_type": "card",
  "psp": "stripe",
  "psp_transaction_id": "pi_3abc123",
  "card": {
    "brand": "visa",
    "last4": "4242",
    "exp_month": 12,
    "exp_year": 2025
  },
  "routing": {
    "attempts": 1,
    "selected_psp": "stripe",
    "selection_reason": "weighted_random",
    "is_retry": false
  },
  "created_at": "2024-01-15T10:31:00Z"
}`}
                />
              </div>
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/capture-payment/:id" description="Capture an authorized payment">
            <div className="space-y-4 mt-4">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                <p className="text-sm text-amber-400">
                  Use for manual capture flows. Omit <code className="text-[#19d1c3]">amount</code> for full capture.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Request Body</h4>
                <ParamTable params={[ { name: 'amount', type: 'integer', description: 'Partial capture amount in cents (optional)' }, ]} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response</h4>
                <CodeBlock language="json" code={`{
  "id": "pay_8xM2nQ4vR7kL9pYz",
  "session_id": "sess_2xK9mN7vQ3pL8wYz",
  "amount": 4990,
  "currency": "USD",
  "status": "captured",
  "payment_method_type": "card",
  "psp": "stripe",
  "psp_transaction_id": "pi_3abc123",
  "captured_amount": 2500,
  "refunded_amount": 0,
  "created_at": "2024-01-15T10:35:00Z"
}`}
                />
              </div>
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/refund-payment/:id" description="Refund a captured payment">
            <div className="space-y-4 mt-4">
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-sm text-red-400">
                  Supports partial refunds by setting <code className="text-[#19d1c3]">amount</code>.
                  Use <code className="text-[#19d1c3]">Idempotency-Key</code> to safely retry.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Request Body</h4>
                <ParamTable params={[ { name: 'amount', type: 'integer', description: 'Partial refund amount in cents (optional)' }, { name: 'reason', type: 'string', description: 'Reason for refund (optional)' }, ]} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response</h4>
                <CodeBlock language="json" code={`{
  "id": "re_8xM2nQ4vR7kL9pYz",
  "payment_id": "pay_8xM2nQ4vR7kL9pYz",
  "amount": 1500,
  "currency": "USD",
  "status": "succeeded",
  "reason": "customer_request",
  "created_at": "2024-01-15T10:40:00Z"
}`}
                />
              </div>
            </div>
          </EndpointCard>

        </div>
      )}

      {/* 3D Secure */}
      {activeTab === '3ds' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Shield}
            title="3D Secure Authentication"
            description="Strong customer authentication for card payments"
          />

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">What is 3D Secure?</h3>
            <p className="text-sm text-gray-400">
              3D Secure (3DS) is an authentication protocol that adds an extra layer of security for online card transactions.
              It shifts liability for fraudulent chargebacks from the merchant to the card issuer.
            </p>
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-white/5">
                <Shield className="h-6 w-6 text-green-400 mb-2" />
                <h4 className="font-medium text-white text-sm">Liability Shift</h4>
                <p className="text-xs text-gray-500 mt-1">Fraud chargebacks become issuer's responsibility</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <Zap className="h-6 w-6 text-[#19d1c3] mb-2" />
                <h4 className="font-medium text-white text-sm">Frictionless Flow</h4>
                <p className="text-xs text-gray-500 mt-1">Low-risk transactions authenticate silently</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <Globe className="h-6 w-6 text-blue-400 mb-2" />
                <h4 className="font-medium text-white text-sm">PSD2 Compliant</h4>
                <p className="text-xs text-gray-500 mt-1">Required for European transactions</p>
              </div>
            </div>
          </div>

          <EndpointCard method="POST" path="/threeds-authenticate" description="Initiate 3DS authentication" defaultExpanded>
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Request Body</h4>
                <ParamTable params={[ { name: 'session_id', type: 'string', required: true, description: 'Payment session ID' }, { name: 'token_id', type: 'string', required: true, description: 'Card token from tokenization' }, { name: 'amount', type: 'integer', required: true, description: 'Transaction amount in cents' }, { name: 'currency', type: 'string', required: true, description: 'Three-letter ISO currency code' }, { name: 'challenge_preference', type: 'string', description: 'no_preference, no_challenge, challenge_requested, challenge_mandated' }, ]} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response - Frictionless (No Challenge)</h4>
                <CodeBlock language="json" code={`{
  "id": "3ds_9xN3oP5wQ8rL",
  "status": "Y",
  "challenge_required": false,
  "authentication_value": "AJkBBkhgTQAAAABXSBlRAAAAAAAA",
  "eci": "05",
  "ds_transaction_id": "f25084f0-5b16-4c0a-ae5d-b24808a95e4b",
  "liability_shift": true
}`}
                />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response - Challenge Required</h4>
                <CodeBlock language="json" code={`{
  "id": "3ds_9xN3oP5wQ8rL",
  "status": "C",
  "challenge_required": true,
  "challenge_url": "https://acs.issuer.com/challenge?id=xxx",
  "acs_transaction_id": "d7c1ee99-9478-44a6-b1f2-391e29c6b340"
}`}
                />
              </div>
            </div>
          </EndpointCard>

          <EndpointCard method="GET" path="/threeds-authenticate/sessions/:id/result" description="Get authentication result">
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-400">
                Retrieve the result after the customer completes the 3DS challenge.
              </p>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Authentication Status Values</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <code className="text-green-400">Y</code>
                    <span className="text-xs text-gray-400 ml-2">Fully authenticated</span>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <code className="text-amber-400">A</code>
                    <span className="text-xs text-gray-400 ml-2">Attempted authentication</span>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <code className="text-red-400">N</code>
                    <span className="text-xs text-gray-400 ml-2">Authentication failed</span>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
                    <code className="text-gray-400">U</code>
                    <span className="text-xs text-gray-400 ml-2">Unable to authenticate</span>
                  </div>
                </div>
              </div>
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/threeds-authenticate/sessions/:id/challenge-complete" description="Complete challenge flow">
            <div className="mt-4">
              <p className="text-sm text-gray-400">
                Call this endpoint after the customer completes the 3DS challenge in the iframe.
                The SDK handles this automatically when using <code className="text-[#19d1c3]">authenticate3DS()</code>.
              </p>
            </div>
          </EndpointCard>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">SDK Integration</h3>
            <CodeBlock title="Using 3DS with the SDK" language="typescript" code={`import { Atlas } from '@atlas/sdk';

// After tokenizing the card
const threeDSResult = await Atlas.authenticate3DS({
  tokenId: 'tok_xxx',
  amount: 4990,
  currency: 'USD',
  challengeContainerId: '3ds-challenge',
  challengePreference: 'no_preference'
});

if (threeDSResult.liability_shift) {
  console.log('Payment protected by 3DS');
}

// Proceed with payment confirmation
await Atlas.confirm();`}
            />
          </div>
        </div>
      )}

      {/* Network Tokens */}
      {activeTab === 'network-tokens' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Zap}
            title="Network Tokens"
            description="Improve authorization rates and reduce interchange costs"
          />

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">What are Network Tokens?</h3>
            <p className="text-sm text-gray-400">
              Network Tokens are dynamic card substitutes provisioned by card networks (Visa, Mastercard, Amex).
              They replace static card numbers with secure tokens, providing significant benefits:
            </p>
            <div className="grid md:grid-cols-4 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center">
                <div className="text-2xl font-bold text-green-400">+5-10%</div>
                <div className="text-xs text-gray-400 mt-1">Higher Auth Rates</div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-[#19d1c3]/10 to-[#c8ff5a]/10 border border-[#19d1c3]/20 text-center">
                <div className="text-2xl font-bold text-[#19d1c3]">-3-5bps</div>
                <div className="text-xs text-gray-400 mt-1">Lower Interchange</div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-center">
                <div className="text-2xl font-bold text-blue-400">Auto</div>
                <div className="text-xs text-gray-400 mt-1">Card Updates</div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-center">
                <div className="text-2xl font-bold text-amber-400">-40%</div>
                <div className="text-xs text-gray-400 mt-1">Less Fraud</div>
              </div>
            </div>
          </div>

          <EndpointCard method="POST" path="/network-tokens" description="Create a network token" defaultExpanded>
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Request Body</h4>
                <ParamTable params={[ { name: 'session_id', type: 'string', required: true, description: 'Payment session ID' }, { name: 'token_id', type: 'string', required: true, description: 'Card token from tokenization' }, { name: 'request_cryptogram', type: 'boolean', description: 'Generate cryptogram immediately (default: false)' }, ]} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response</h4>
                <CodeBlock language="json" code={`{
  "networkTokenId": "nt_7xL9mN2vQ4pK",
  "network": "visa",
  "status": "active",
  "tokenExpiryMonth": "12",
  "tokenExpiryYear": "2028",
  "cryptogram": "AJkBBkhgTQAAAABXSBlRAAAAAAAA",
  "cryptogramType": "TAVV"
}`}
                />
              </div>
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/network-tokens/:id/cryptogram" description="Generate a cryptogram">
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-400">
                Generate a new cryptogram for a cardholder-initiated transaction (CIT).
                Cryptograms are single-use and expire after 10 minutes.
              </p>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Request Body</h4>
                <ParamTable params={[ { name: 'session_id', type: 'string', required: true, description: 'Payment session ID' }, ]} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response</h4>
                <CodeBlock language="json" code={`{
  "cryptogram": "AJkBBkhgTQAAAABXSBlRAAAAAAAA",
  "cryptogramType": "TAVV",
  "expiresAt": "2024-01-15T10:41:00Z"
}`}
                />
              </div>
            </div>
          </EndpointCard>

          <EndpointCard method="GET" path="/network-tokens/:id" description="Get network token details">
            <div className="mt-4">
              <p className="text-sm text-gray-400">
                Retrieve the current status and details of a network token.
                Include <code className="text-[#19d1c3]">session_id</code> as a query parameter.
              </p>
            </div>
          </EndpointCard>

          <EndpointCard method="DELETE" path="/network-tokens/:id" description="Delete a network token">
            <div className="mt-4">
              <p className="text-sm text-gray-400">
                Suspend and delete a network token. Use when a customer removes their saved card.
                Include <code className="text-[#19d1c3]">session_id</code> as a query parameter.
              </p>
            </div>
          </EndpointCard>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">SDK Integration</h3>
            <CodeBlock title="Using Network Tokens" language="typescript" code={`import { Atlas } from '@atlas/sdk';

// Create a network token for a saved card
const networkToken = await Atlas.createNetworkToken({
  tokenId: 'tok_xxx',
  requestCryptogram: true
});

console.log('Network Token:', networkToken.networkTokenId);
console.log('Cryptogram:', networkToken.cryptogram);

// For subsequent transactions, generate a new cryptogram
const cryptogram = await Atlas.getCryptogram(networkToken.networkTokenId);
console.log('Next cryptogram:', cryptogram.cryptogram);

// Confirm a payment and request network tokenization
await Atlas.confirm('card', { networkToken: true });`}
            />
          </div>
        </div>
      )}

      {/* Card Collection Proxy */}
      {activeTab === 'card-proxy' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Server}
            title="API Card Collection"
            description="Receive card data via API while staying PCI compliant"
          />

          <EndpointCard method="POST" path="/card-collection-proxy" description="Tokenize inbound card data and forward it to your endpoint" defaultExpanded>
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Headers</h4>
                <ParamTable params={[ { name: 'ATLAS-PROXY-KEY', type: 'string', required: true, description: 'Proxy key from dashboard configuration' }, ]} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Response</h4>
                <p className="text-sm text-gray-400">Returns the downstream response from your destination URL after tokenization.</p>
              </div>
            </div>
          </EndpointCard>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Use Cases</h3>
            <p className="text-sm text-gray-400">
              The Card Collection Proxy allows you to receive card data from external systems without increasing your PCI scope.
              Perfect for:
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-white/5 flex items-start gap-3">
                <Building2 className="h-5 w-5 text-[#19d1c3] mt-0.5" />
                <div>
                  <h4 className="font-medium text-white text-sm">B2B Partner Integrations</h4>
                  <p className="text-xs text-gray-500 mt-1">Accept card data from booking engines, ERP systems, or partner platforms</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white/5 flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-[#c8ff5a] mt-0.5" />
                <div>
                  <h4 className="font-medium text-white text-sm">AI Agent Payments</h4>
                  <p className="text-xs text-gray-500 mt-1">Enable AI assistants to securely process payments on behalf of users</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white/5 flex items-start gap-3">
                <Webhook className="h-5 w-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-white text-sm">Webhook Card Collection</h4>
                  <p className="text-xs text-gray-500 mt-1">Intercept webhooks containing card data and tokenize automatically</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white/5 flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-green-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-white text-sm">Legacy System Migration</h4>
                  <p className="text-xs text-gray-500 mt-1">Migrate from legacy payment systems without code changes</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">How It Works</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="h-10 w-10 rounded-full bg-[#19d1c3]/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-[#19d1c3] font-bold">1</span>
                </div>
                <p className="text-xs text-gray-400">Partner sends card data to your Atlas proxy URL</p>
              </div>
              <div className="text-center">
                <div className="h-10 w-10 rounded-full bg-[#19d1c3]/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-[#19d1c3] font-bold">2</span>
                </div>
                <p className="text-xs text-gray-400">Proxy extracts card data from configured field path</p>
              </div>
              <div className="text-center">
                <div className="h-10 w-10 rounded-full bg-[#19d1c3]/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-[#19d1c3] font-bold">3</span>
                </div>
                <p className="text-xs text-gray-400">Card data tokenized securely (never stored)</p>
              </div>
              <div className="text-center">
                <div className="h-10 w-10 rounded-full bg-[#19d1c3]/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-[#19d1c3] font-bold">4</span>
                </div>
                <p className="text-xs text-gray-400">Tokenized request forwarded to your endpoint</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Proxy Configuration</h3>
            <p className="text-sm text-gray-400 mb-4">
              Configure your proxy in the dashboard. Each proxy has a unique key and destination URL.
            </p>
            <ParamTable params={[ { name: 'destination_url', type: 'string', required: true, description: 'Your endpoint that receives tokenized requests' }, { name: 'card_field_path', type: 'string', required: true, description: 'JSON path to card data (e.g., "payment.card" or "data.card_details")' }, { name: 'require_auth', type: 'boolean', description: 'Require authentication for incoming requests' }, { name: 'auth_type', type: 'string', description: '"api_key" or "jwt" - authentication method' }, { name: 'rate_limit_per_minute', type: 'integer', description: 'Maximum requests per minute (default: 100)' }, ]} />
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Supported Content Types</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <code className="text-sm text-[#19d1c3]">application/json</code>
                <p className="text-xs text-gray-500 mt-2">Standard JSON payloads with nested card objects</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <code className="text-sm text-[#19d1c3]">application/xml</code>
                <p className="text-xs text-gray-500 mt-2">XML payloads from legacy systems</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <code className="text-sm text-[#19d1c3]">application/x-www-form-urlencoded</code>
                <p className="text-xs text-gray-500 mt-2">Form data from web forms</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Example: JSON Request</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Incoming Request (from partner)</h4>
                <CodeBlock language="json" code={`POST /proxy/{proxy_key}
ATLAS-PROXY-KEY: prx_abc123

{
  "booking_id": "BK-12345",
  "guest": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "payment": {
    "card": {
      "number": "4242424242424242",
      "expiration_month": 12,
      "expiration_year": 2025,
      "cvc": "123"
    }
  },
  "amount": 15000
}`}
                />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Forwarded to Your Endpoint</h4>
                <CodeBlock language="json" code={`POST https://your-api.com/bookings
X-Atlas-Token-Intent: ti_9xN3oP5wQ8

{
  "booking_id": "BK-12345",
  "guest": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "payment": {
    "card": {
      "token_intent_id": "ti_9xN3oP5wQ8",
      "type": "token_intent"
    }
  },
  "amount": 15000
}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Webhook}
            title="Webhooks"
            description="Receive real-time notifications for payment events"
          />

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Event Types</h3>
            <div className="space-y-2">
              {[ { type: 'payment.authorized', desc: 'Payment authorized (manual capture mode)', color: 'blue' }, { type: 'payment.captured', desc: 'Payment captured successfully', color: 'green' }, { type: 'payment.failed', desc: 'Payment attempt failed', color: 'red' }, { type: 'payment.requires_action', desc: '3DS or other action required', color: 'amber' }, { type: 'payment.canceled', desc: 'Payment was canceled', color: 'gray' }, { type: 'refund.succeeded', desc: 'Refund processed successfully', color: 'green' }, { type: 'refund.failed', desc: 'Refund attempt failed', color: 'red' }, { type: 'dispute.created', desc: 'New dispute/chargeback opened', color: 'red' }, { type: 'dispute.updated', desc: 'Dispute status changed', color: 'amber' }, { type: 'dispute.closed', desc: 'Dispute resolved', color: 'gray' }, ].map((event) => (
                <div key={event.type} className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <code className="text-sm text-[#19d1c3] font-mono min-w-[200px]">{event.type}</code>
                  <span className="text-sm text-gray-400">{event.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Webhook Payload Structure</h3>
            <CodeBlock language="json" code={`{
  "id": "evt_9xN3oP5wQ8rL2mYz",
  "object": "event",
  "type": "payment.captured",
  "api_version": "2024-01-01",
  "created_at": "2024-01-15T10:31:00Z",
  "livemode": true,
  "data": {
    "object": {
      "id": "pay_8xM2nQ4vR7kL9pYz",
      "object": "payment",
      "amount": 4990,
      "currency": "USD",
      "status": "succeeded",
      "customer": {
        "email": "customer@example.com"
      },
      "card": {
        "brand": "visa",
        "last4": "4242"
      },
      "metadata": {
        "order_id": "order_12345"
      }
    }
  },
  "request": {
    "id": "req_abc123",
    "idempotency_key": "order_12345_payment"
  }
}`}
            />
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Verifying Signatures</h3>
            <p className="text-sm text-gray-400 mb-4">
              Always verify webhook signatures to ensure events are from Atlas. We include these headers:
            </p>
            <ParamTable params={[ { name: 'x-atlas-signature', type: 'string', description: 'HMAC-SHA256 signature of the payload' }, { name: 'x-atlas-timestamp', type: 'string', description: 'Unix timestamp when the event was sent' }, ]} />

            <CodeBlock title="Verification Example" language="typescript" code={`import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, timestamp: string, secret: string): boolean {
  // Reject if timestamp is too old (prevent replay attacks)
  const timestampAge = Date.now() - parseInt(timestamp) * 1000;
  if (timestampAge > 300000) { // 5 minutes
    return false;
  }

  // Compute expected signature
  const signedPayload = timestamp + '.' + payload;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}`}
            />
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Best Practices</h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Return 200 quickly</strong> - Acknowledge receipt before processing. Use background jobs for heavy operations.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Handle duplicates</strong> - Use the event ID for idempotency. We may retry delivery.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Verify signatures</strong> - Never process webhooks without signature verification.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Use HTTPS</strong> - Webhook endpoints must use TLS encryption.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Retry Policy</h3>
            <p className="text-sm text-gray-400">
              We retry failed webhook deliveries with exponential backoff:
            </p>
            <div className="grid grid-cols-5 gap-2 mt-4">
              {['Immediately', '1 min', '5 min', '30 min', '2 hours'].map((time, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/5 text-center">
                  <div className="text-xs text-gray-500">Attempt {i + 1}</div>
                  <div className="text-sm text-white font-medium">{time}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              After 5 failed attempts, the webhook is marked as failed. You can view failed webhooks and manually retry in the dashboard.
            </p>
          </div>
        </div>
      )}

      {/* SDK Reference */}
      {activeTab === 'sdk' && (
        <div className="space-y-6">
          <SectionHeader
            icon={FileCode}
            title="SDK Reference"
            description="Complete reference for the Atlas JavaScript SDK"
          />

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Installation</h3>
            <CodeBlock language="bash" code={`npm install @atlas/sdk`}
            />
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-6">
            <h3 className="font-semibold text-white">Core Methods</h3>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <code className="text-sm text-[#19d1c3]">Atlas.configure(options)</code>
                  <Badge variant="outline" className="text-xs">Optional</Badge>
                </div>
                <p className="text-sm text-gray-400">Configure the SDK globally. Call before other methods.</p>
                <CodeBlock language="typescript" code={`Atlas.configure({
  environment: 'production', // 'sandbox' | 'production'
  locale: 'en-US',
  resilience: {
    enableFallback: true,
    fallbackEndpoints: ['https://fallback.atlas.co'],
    circuitBreakerThreshold: 5
  }
});`}
                />
              </div>

              <div className="p-4 rounded-lg bg-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <code className="text-sm text-[#19d1c3]">Atlas.mount(config)</code>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
                <p className="text-sm text-gray-400">Mount the payment form in a DOM element.</p>
                <ParamTable params={[ { name: 'sessionId', type: 'string', required: true, description: 'Payment session ID from your server' }, { name: 'clientSecret', type: 'string', required: true, description: 'Client secret from session creation' }, { name: 'elementId', type: 'string', required: true, description: 'DOM element ID to mount into' }, { name: 'appearance', type: 'object', description: 'Styling options (theme, variables, rules)' }, { name: 'paymentMethods', type: 'array', description: 'Enabled methods: ["card", "apple_pay", "google_pay"]' }, { name: 'onReady', type: 'function', description: 'Called when form is ready' }, { name: 'onSuccess', type: 'function', description: 'Called with payment object on success' }, { name: 'onError', type: 'function', description: 'Called with error object on failure' }, { name: 'onValidationChange', type: 'function', description: 'Called when form validation changes' }, ]} />
              </div>

              <div className="p-4 rounded-lg bg-white/5 space-y-3">
                <code className="text-sm text-[#19d1c3]">Atlas.unmount()</code>
                <p className="text-sm text-gray-400">Clean up and remove the payment form. Call when navigating away or on component unmount.</p>
              </div>

              <div className="p-4 rounded-lg bg-white/5 space-y-3">
                <code className="text-sm text-[#19d1c3]">Atlas.confirm(options?)</code>
                <p className="text-sm text-gray-400">Manually trigger payment confirmation. Usually automatic on form submit.</p>
                <CodeBlock language="typescript" code={`const payment = await Atlas.confirm({
  paymentMethod: 'card', // Optional: specify method
  returnUrl: 'https://yoursite.com/complete' // For 3DS redirects
});`}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-6">
            <h3 className="font-semibold text-white">3D Secure Methods</h3>

            <div className="p-4 rounded-lg bg-white/5 space-y-3">
              <code className="text-sm text-[#19d1c3]">Atlas.authenticate3DS(config)</code>
              <p className="text-sm text-gray-400">Initiate 3D Secure authentication for a payment.</p>
              <CodeBlock language="typescript" code={`const result = await Atlas.authenticate3DS({
  sessionId: 'sess_xxx',
  tokenId: 'tok_xxx',
  amount: 4990,
  currency: 'USD',
  challengePreference: 'no_preference', // Optional
  onChallengeRequired: (url) => {
    // SDK handles challenge automatically
    console.log('Challenge started');
  }
});

// result: { status: 'Y', authenticationValue: '...', eci: '05', liabilityShift: true }`}
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-6">
            <h3 className="font-semibold text-white">Network Token Methods</h3>

            <div className="p-4 rounded-lg bg-white/5 space-y-3">
              <code className="text-sm text-[#19d1c3]">Atlas.createNetworkToken(config)</code>
              <p className="text-sm text-gray-400">Create a network token for improved authorization rates.</p>
              <CodeBlock language="typescript" code={`const networkToken = await Atlas.createNetworkToken({
  sessionId: 'sess_xxx',
  tokenId: 'tok_xxx',
  requestCryptogram: true
});

// networkToken: { networkTokenId: 'nt_xxx', network: 'visa', cryptogram: '...' }`}
              />
            </div>

            <div className="p-4 rounded-lg bg-white/5 space-y-3">
              <code className="text-sm text-[#19d1c3]">Atlas.getCryptogram(networkTokenId)</code>
              <p className="text-sm text-gray-400">Generate a new cryptogram for an existing network token.</p>
              <CodeBlock language="typescript" code={`const cryptogram = await Atlas.getCryptogram('nt_xxx');
// cryptogram: { cryptogram: '...', cryptogramType: 'TAVV', expiresAt: '...' }`}
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-6">
            <h3 className="font-semibold text-white">Digital Wallet Methods</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white/5 space-y-2">
                <code className="text-sm text-[#19d1c3]">Atlas.isApplePayAvailable()</code>
                <p className="text-xs text-gray-400">Returns boolean - true if Apple Pay is available on this device/browser.</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 space-y-2">
                <code className="text-sm text-[#19d1c3]">Atlas.isGooglePayAvailable()</code>
                <p className="text-xs text-gray-400">Returns Promise&lt;boolean&gt; - checks Google Pay availability asynchronously.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-6">
            <h3 className="font-semibold text-white">Resilience Methods</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white/5 space-y-2">
                <code className="text-sm text-[#19d1c3]">Atlas.getCircuitBreakerState()</code>
                <p className="text-xs text-gray-400">Returns current state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 space-y-2">
                <code className="text-sm text-[#19d1c3]">Atlas.getHealthStatus()</code>
                <p className="text-xs text-gray-400">Returns Promise with endpoint health info</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 space-y-2">
                <code className="text-sm text-[#19d1c3]">Atlas.getPendingSyncTransactions()</code>
                <p className="text-xs text-gray-400">Returns transactions processed in fallback mode</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 space-y-2">
                <code className="text-sm text-[#19d1c3]">Atlas.syncPendingTransactions()</code>
                <p className="text-xs text-gray-400">Sync fallback transactions when primary recovers</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-6">
            <h3 className="font-semibold text-white">Webhook Verification</h3>

            <div className="p-4 rounded-lg bg-white/5 space-y-3">
              <p className="text-sm text-gray-400">Verify webhook signatures server-side using HMAC-SHA256.</p>
              <CodeBlock language="typescript" code={`import crypto from 'crypto';

const signatureHeader = req.headers['x-atlas-signature'];
const secret = process.env.ATLAS_WEBHOOK_SECRET;

const parts = signatureHeader.split(',');
const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1];
const signature = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

const payload = req.body.toString('utf8');
const expected = crypto
  .createHmac('sha256', secret)
  .update(timestamp + '.' + payload)
  .digest('hex');

const isValid = signature && crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expected)
);`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {activeTab === 'errors' && (
        <div className="space-y-6">
          <SectionHeader
            icon={AlertTriangle}
            title="Error Handling"
            description="Understand and handle API errors"
          />

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Error Response Format</h3>
            <CodeBlock language="json" code={`{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "message": "Your card was declined.",
    "param": "card_number",
    "decline_code": "insufficient_funds",
    "doc_url": "https://docs.atlas.co/errors/card_declined"
  }
}`}
            />
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">HTTP Status Codes</h3>
            <div className="space-y-2">
              {[ { code: '200', desc: 'Success', color: 'green' }, { code: '400', desc: 'Bad Request - Invalid parameters', color: 'amber' }, { code: '401', desc: 'Unauthorized - Invalid or missing API key', color: 'red' }, { code: '402', desc: 'Payment Required - Card declined', color: 'red' }, { code: '403', desc: 'Forbidden - Insufficient permissions', color: 'red' }, { code: '404', desc: 'Not Found - Resource doesn\'t exist', color: 'amber' }, { code: '409', desc: 'Conflict - Idempotency conflict', color: 'amber' }, { code: '429', desc: 'Too Many Requests - Rate limit exceeded', color: 'amber' }, { code: '500', desc: 'Server Error - Something went wrong', color: 'red' }, { code: '503', desc: 'Service Unavailable - Temporary outage', color: 'red' }, ].map((status) => (
                <div key={status.code} className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <Badge className={`bg-${status.color}-500/10 text-${status.color}-400 border-${status.color}-500/20 font-mono`}>
                    {status.code}
                  </Badge>
                  <span className="text-sm text-gray-400">{status.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Error Types</h3>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-white/5">
                <code className="text-[#19d1c3]">api_error</code>
                <p className="text-sm text-gray-400 mt-1">Server-side error. Safe to retry with exponential backoff.</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <code className="text-[#19d1c3]">authentication_error</code>
                <p className="text-sm text-gray-400 mt-1">Invalid API key or insufficient permissions. Check your credentials.</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <code className="text-[#19d1c3]">card_error</code>
                <p className="text-sm text-gray-400 mt-1">Card was declined. Show message to customer.</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <code className="text-[#19d1c3]">invalid_request_error</code>
                <p className="text-sm text-gray-400 mt-1">Invalid parameters. Check the 'param' field for details.</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <code className="text-[#19d1c3]">rate_limit_error</code>
                <p className="text-sm text-gray-400 mt-1">Too many requests. Implement backoff and retry.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Common Decline Codes</h3>
            <div className="grid md:grid-cols-2 gap-2">
              {[ { code: 'insufficient_funds', desc: 'Not enough funds' }, { code: 'lost_card', desc: 'Card reported lost' }, { code: 'stolen_card', desc: 'Card reported stolen' }, { code: 'expired_card', desc: 'Card has expired' }, { code: 'incorrect_cvc', desc: 'CVC code incorrect' }, { code: 'processing_error', desc: 'Temporary processor issue' }, { code: 'do_not_honor', desc: 'Issuer declined' }, { code: 'card_not_supported', desc: 'Card type not accepted' }, ].map((decline) => (
                <div key={decline.code} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <code className="text-xs text-red-400">{decline.code}</code>
                  <span className="text-xs text-gray-400">{decline.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Error Handling Example</h3>
            <CodeBlock language="typescript" code={`try {
  const payment = await Atlas.confirm();
  console.log('Payment succeeded:', payment.id);
} catch (error) {
  switch (error.type) {
    case 'card_error':
      // Show user-friendly message
      showError(error.message);
      break;
    case 'validation_error':
      // Highlight invalid field
      highlightField(error.param);
      break;
    case 'api_error':
      // Retry with backoff or show generic error
      if (retryCount < 3) {
        await delay(1000 * Math.pow(2, retryCount));
        return retry();
      }
      showError('Something went wrong. Please try again.');
      break;
    default:
      showError('An unexpected error occurred.');
  }
}`}
            />
          </div>
        </div>
      )}

      {/* Testing */}
      {activeTab === 'testing' && (
        <div className="space-y-6">
          <SectionHeader
            icon={BookOpen}
            title="Testing"
            description="Test your integration with sandbox credentials"
          />

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Test Environment</h3>
            <p className="text-sm text-gray-400">
              Use test API keys (starting with <code className="text-[#19d1c3]">sk_test_</code>) to test your integration without processing real payments.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-sm text-amber-400">Test Mode</span>
              </div>
              <span className="text-sm text-gray-500">No real charges • Test cards only • Simulated responses</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Test Card Numbers</h3>
            <p className="text-sm text-gray-400 mb-4">Use these card numbers with any future expiry date and any 3-digit CVC.</p>

            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <h4 className="text-sm font-medium text-green-400 mb-3">Successful Payments</h4>
                <div className="grid md:grid-cols-2 gap-2">
                  {[ { number: '4242 4242 4242 4242', brand: 'Visa', desc: 'Succeeds' }, { number: '5555 5555 5555 4444', brand: 'Mastercard', desc: 'Succeeds' }, { number: '3782 822463 10005', brand: 'Amex', desc: 'Succeeds' }, { number: '6011 1111 1111 1117', brand: 'Discover', desc: 'Succeeds' }, ].map((card) => (
                    <div key={card.number} className="flex items-center gap-3 p-2 rounded bg-white/5">
                      <code className="text-xs text-white font-mono">{card.number}</code>
                      <span className="text-xs text-gray-500">{card.brand}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <h4 className="text-sm font-medium text-red-400 mb-3">Declined Payments</h4>
                <div className="grid md:grid-cols-2 gap-2">
                  {[ { number: '4000 0000 0000 0002', desc: 'Card declined' }, { number: '4000 0000 0000 9995', desc: 'Insufficient funds' }, { number: '4000 0000 0000 9987', desc: 'Lost card' }, { number: '4000 0000 0000 9979', desc: 'Stolen card' }, { number: '4000 0000 0000 0069', desc: 'Expired card' }, { number: '4000 0000 0000 0127', desc: 'Incorrect CVC' }, ].map((card) => (
                    <div key={card.number} className="flex items-center gap-3 p-2 rounded bg-white/5">
                      <code className="text-xs text-white font-mono">{card.number}</code>
                      <span className="text-xs text-gray-500">{card.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <h4 className="text-sm font-medium text-blue-400 mb-3">3D Secure Testing</h4>
                <div className="grid md:grid-cols-2 gap-2">
                  {[ { number: '4000 0000 0000 3220', desc: '3DS required, succeeds' }, { number: '4000 0000 0000 3063', desc: '3DS required, fails' }, { number: '4000 0000 0000 3055', desc: '3DS optional, succeeds' }, { number: '4000 0027 6000 3184', desc: 'Frictionless (no challenge)' }, ].map((card) => (
                    <div key={card.number} className="flex items-center gap-3 p-2 rounded bg-white/5">
                      <code className="text-xs text-white font-mono">{card.number}</code>
                      <span className="text-xs text-gray-500">{card.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Testing Webhooks Locally</h3>
            <p className="text-sm text-gray-400">
              Use our CLI or a tunnel service to receive webhooks during development.
            </p>
            <CodeBlock title="Using Atlas CLI" language="bash" code={`# Install the CLI
npm install -g @atlas/cli

# Forward webhooks to your local server
atlas listen --forward-to localhost:3000/webhooks/atlas

# Output:
# Ready! Webhook signing secret: whsec_xxx
# Forwarding webhooks to http://localhost:3000/webhooks/atlas`}
            />
          </div>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h3 className="font-semibold text-white">Going Live Checklist</h3>
            <div className="space-y-2">
              {[ 'Switch to live API keys (sk_live_...)', 'Update webhook endpoints to production URLs', 'Test with real cards (small amounts)', 'Verify webhook signature validation', 'Enable 3D Secure for PSD2 compliance', 'Set up monitoring and alerting', 'Configure proper error handling', 'Remove any hardcoded test values', ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <div className="h-5 w-5 rounded border border-white/20 flex items-center justify-center">
                    <span className="text-xs text-gray-500">{i + 1}</span>
                  </div>
                  <span className="text-sm text-gray-400">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Billing / Subscriptions */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Repeat}
            title="Billing & Subscriptions"
            description="Create and manage recurring subscriptions with products, prices, and billing cycles"
          />

          <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Stripe-like Subscription Billing</h2>
            <p className="text-gray-400 text-sm">Build advanced billing logic with products, recurring prices, trials, usage-based billing, and automatic invoicing.</p>
          </div>

          {/* Products */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Products</h3>
            <EndpointCard method="POST" path="/products" description="Create a product">
              <ParamTable params={[
                { name: 'name', type: 'string', required: true, description: 'Product name displayed to customers' },
                { name: 'description', type: 'string', description: 'Optional product description' },
                { name: 'metadata', type: 'object', description: 'Key-value pairs for your use' },
              ]} />
              <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/products \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Pro Plan",
    "description": "Full access to all features",
    "metadata": { "tier": "pro" }
  }'`} />
            </EndpointCard>

            <EndpointCard method="GET" path="/products" description="List all products">
              <CodeBlock title="Response" language="json" code={`{
  "object": "list",
  "data": [
    {
      "id": "prod_xxx",
      "object": "product",
      "name": "Pro Plan",
      "description": "Full access to all features",
      "active": true,
      "metadata": { "tier": "pro" },
      "created": 1704844800
    }
  ],
  "has_more": false,
  "total_count": 1
}`} />
            </EndpointCard>
          </div>

          {/* Prices */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Prices</h3>
            <EndpointCard method="POST" path="/prices" description="Create a price">
              <ParamTable params={[
                { name: 'product', type: 'string', required: true, description: 'Product ID to attach price to' },
                { name: 'currency', type: 'string', required: true, description: '3-letter ISO currency code (e.g. usd)' },
                { name: 'unit_amount', type: 'integer', description: 'Amount in cents (e.g. 2999 = $29.99)' },
                { name: 'type', type: 'string', description: 'one_time or recurring (default: one_time)' },
                { name: 'recurring', type: 'object', description: 'Recurring billing config', children: [
                  { name: 'interval', type: 'string', description: 'day, week, month, or year' },
                  { name: 'interval_count', type: 'integer', description: 'Number of intervals (default: 1)' },
                  { name: 'usage_type', type: 'string', description: 'licensed or metered' },
                ] },
              ]} />
              <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/prices \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "product": "prod_xxx",
    "currency": "usd",
    "unit_amount": 2999,
    "type": "recurring",
    "recurring": {
      "interval": "month",
      "interval_count": 1
    }
  }'`} />
            </EndpointCard>
          </div>

          {/* Subscriptions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Subscriptions</h3>
            <EndpointCard method="POST" path="/subscriptions" description="Create a subscription">
              <ParamTable params={[
                { name: 'customer', type: 'string', required: true, description: 'Customer ID' },
                { name: 'items', type: 'array', required: true, description: 'Array of { price: "price_xxx", quantity: 1 }' },
                { name: 'trial_period_days', type: 'integer', description: 'Free trial days before billing' },
                { name: 'cancel_at_period_end', type: 'boolean', description: 'Cancel at end of current period' },
                { name: 'metadata', type: 'object', description: 'Key-value pairs for your use' },
              ]} />
              <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/subscriptions \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer": "cus_xxx",
    "items": [{ "price": "price_xxx", "quantity": 1 }],
    "trial_period_days": 14
  }'`} />
            </EndpointCard>

            <EndpointCard method="POST" path="/subscriptions/:id/pause" description="Pause a subscription">
              <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/subscriptions/sub_xxx/pause \\
  -H "Authorization: Bearer sk_test_xxx"`} />
            </EndpointCard>

            <EndpointCard method="POST" path="/subscriptions/:id/resume" description="Resume a paused subscription">
              <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/subscriptions/sub_xxx/resume \\
  -H "Authorization: Bearer sk_test_xxx"`} />
            </EndpointCard>

            <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
              <h4 className="font-semibold text-white">Subscription Statuses</h4>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { status: 'trialing', desc: 'Customer is in free trial period' },
                  { status: 'active', desc: 'Subscription is active and billing' },
                  { status: 'past_due', desc: 'Payment failed, retrying' },
                  { status: 'paused', desc: 'Subscription paused by request' },
                  { status: 'canceled', desc: 'Subscription has been canceled' },
                  { status: 'unpaid', desc: 'All retries exhausted, not canceled' },
                ].map((item) => (
                  <div key={item.status} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <code className="text-xs text-violet-400">{item.status}</code>
                    <span className="text-xs text-gray-500">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Usage Records */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Usage Records (Metered Billing)</h3>
            <EndpointCard method="POST" path="/usage-records" description="Report usage for a metered subscription item">
              <ParamTable params={[
                { name: 'subscription_item', type: 'string', required: true, description: 'Subscription item ID' },
                { name: 'quantity', type: 'integer', required: true, description: 'Usage quantity to record' },
                { name: 'action', type: 'string', description: 'increment or set (default: increment)' },
                { name: 'timestamp', type: 'integer', description: 'Unix timestamp (default: now)' },
              ]} />
              <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/usage-records \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subscription_item": "si_xxx",
    "quantity": 150,
    "action": "increment"
  }'`} />
            </EndpointCard>
          </div>

          {/* Coupons */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Coupons</h3>
            <EndpointCard method="POST" path="/coupons" description="Create a coupon">
              <ParamTable params={[
                { name: 'duration', type: 'string', required: true, description: 'once, repeating, or forever' },
                { name: 'percent_off', type: 'number', description: 'Percentage discount (0-100)' },
                { name: 'amount_off', type: 'integer', description: 'Fixed amount off in cents' },
                { name: 'currency', type: 'string', description: 'Required if using amount_off' },
                { name: 'duration_in_months', type: 'integer', description: 'Required if duration is repeating' },
                { name: 'max_redemptions', type: 'integer', description: 'Max times coupon can be used' },
                { name: 'redeem_by', type: 'integer', description: 'Unix timestamp when coupon expires' },
              ]} />
              <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/coupons \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "SAVE20",
    "percent_off": 20,
    "duration": "repeating",
    "duration_in_months": 3
  }'`} />
            </EndpointCard>
          </div>
        </div>
      )}

      {/* Customers */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Users}
            title="Customers"
            description="Create and manage customer records for billing"
          />

          <EndpointCard method="POST" path="/customers" description="Create a customer" defaultExpanded>
            <ParamTable params={[
              { name: 'email', type: 'string', required: true, description: 'Customer email address' },
              { name: 'name', type: 'string', description: 'Customer full name' },
              { name: 'phone', type: 'string', description: 'Customer phone number' },
              { name: 'metadata', type: 'object', description: 'Key-value pairs for your use' },
              { name: 'address', type: 'object', description: 'Customer billing address', children: [
                { name: 'line1', type: 'string', description: 'Street address' },
                { name: 'city', type: 'string', description: 'City' },
                { name: 'state', type: 'string', description: 'State or province' },
                { name: 'postal_code', type: 'string', description: 'ZIP or postal code' },
                { name: 'country', type: 'string', description: 'Two-letter country code' },
              ] },
            ]} />
            <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/customers \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "customer@example.com",
    "name": "Jane Doe",
    "metadata": { "user_id": "123" }
  }'`} />
            <CodeBlock title="Response" language="json" code={`{
  "id": "cus_xxx",
  "object": "customer",
  "email": "customer@example.com",
  "name": "Jane Doe",
  "metadata": { "user_id": "123" },
  "created": 1704844800
}`} />
          </EndpointCard>

          <EndpointCard method="GET" path="/customers" description="List all customers">
            <CodeBlock title="Request" language="bash" code={`curl ${API_BASE}/customers?limit=10 \\
  -H "Authorization: Bearer sk_test_xxx"`} />
          </EndpointCard>

          <EndpointCard method="GET" path="/customers/:id" description="Retrieve a customer">
            <CodeBlock title="Request" language="bash" code={`curl ${API_BASE}/customers/cus_xxx \\
  -H "Authorization: Bearer sk_test_xxx"`} />
          </EndpointCard>

          <EndpointCard method="PATCH" path="/customers/:id" description="Update a customer">
            <CodeBlock title="Request" language="bash" code={`curl -X PATCH ${API_BASE}/customers/cus_xxx \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Jane Smith" }'`} />
          </EndpointCard>

          <EndpointCard method="DELETE" path="/customers/:id" description="Delete a customer">
            <CodeBlock title="Request" language="bash" code={`curl -X DELETE ${API_BASE}/customers/cus_xxx \\
  -H "Authorization: Bearer sk_test_xxx"`} />
          </EndpointCard>
        </div>
      )}

      {/* Invoices */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Receipt}
            title="Invoices"
            description="Create, manage, and collect payment on invoices"
          />

          <EndpointCard method="POST" path="/invoices" description="Create an invoice" defaultExpanded>
            <ParamTable params={[
              { name: 'customer', type: 'string', required: true, description: 'Customer ID to bill' },
              { name: 'auto_advance', type: 'boolean', description: 'Auto-finalize after 1 hour (default: true)' },
              { name: 'collection_method', type: 'string', description: 'charge_automatically or send_invoice' },
              { name: 'days_until_due', type: 'integer', description: 'Days until payment is due' },
              { name: 'description', type: 'string', description: 'Invoice description' },
            ]} />
            <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/invoices \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer": "cus_xxx",
    "collection_method": "send_invoice",
    "days_until_due": 30
  }'`} />
          </EndpointCard>

          <EndpointCard method="GET" path="/invoices" description="List all invoices">
            <ParamTable params={[
              { name: 'customer', type: 'string', description: 'Filter by customer ID' },
              { name: 'status', type: 'string', description: 'Filter by status (draft, open, paid, void)' },
              { name: 'subscription', type: 'string', description: 'Filter by subscription ID' },
            ]} />
          </EndpointCard>

          <EndpointCard method="POST" path="/invoices/:id/finalize" description="Finalize a draft invoice">
            <p className="text-sm text-gray-400">Transitions invoice from draft to open, making it ready for payment.</p>
            <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/invoices/inv_xxx/finalize \\
  -H "Authorization: Bearer sk_test_xxx"`} />
          </EndpointCard>

          <EndpointCard method="POST" path="/invoices/:id/pay" description="Pay an invoice">
            <p className="text-sm text-gray-400">Attempt to collect payment on an open invoice.</p>
            <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/invoices/inv_xxx/pay \\
  -H "Authorization: Bearer sk_test_xxx"`} />
          </EndpointCard>

          <EndpointCard method="POST" path="/invoices/:id/void" description="Void an invoice">
            <p className="text-sm text-gray-400">Permanently void an invoice. Cannot be undone.</p>
            <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/invoices/inv_xxx/void \\
  -H "Authorization: Bearer sk_test_xxx"`} />
          </EndpointCard>

          <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
            <h4 className="font-semibold text-white">Invoice Statuses</h4>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { status: 'draft', desc: 'Invoice is being prepared, not yet sent' },
                { status: 'open', desc: 'Invoice has been finalized and sent' },
                { status: 'paid', desc: 'Invoice has been paid in full' },
                { status: 'void', desc: 'Invoice was canceled and is invalid' },
                { status: 'uncollectible', desc: 'Payment attempts exhausted' },
              ].map((item) => (
                <div key={item.status} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <code className="text-xs text-violet-400">{item.status}</code>
                  <span className="text-xs text-gray-500">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Checkout & Portal Sessions */}
      {activeTab === 'checkout' && (
        <div className="space-y-6">
          <SectionHeader
            icon={Building2}
            title="Checkout & Portal Sessions"
            description="Create hosted payment pages for checkout and customer self-service"
          />

          <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Hosted Payment Pages</h2>
            <p className="text-gray-400 text-sm">Pre-built, conversion-optimized pages for checkout and customer management. No frontend code required.</p>
          </div>

          {/* Checkout Sessions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Checkout Sessions</h3>
            <EndpointCard method="POST" path="/checkout-sessions" description="Create a checkout session" defaultExpanded>
              <ParamTable params={[
                { name: 'mode', type: 'string', required: true, description: 'payment or subscription' },
                { name: 'line_items', type: 'array', required: true, description: 'Array of { price: "price_xxx", quantity: 1 }' },
                { name: 'success_url', type: 'string', required: true, description: 'Redirect URL after successful payment' },
                { name: 'cancel_url', type: 'string', required: true, description: 'Redirect URL if customer cancels' },
                { name: 'customer', type: 'string', description: 'Existing customer ID' },
                { name: 'customer_email', type: 'string', description: 'Pre-fill customer email' },
                { name: 'subscription_data', type: 'object', description: 'Subscription options', children: [
                  { name: 'trial_period_days', type: 'integer', description: 'Free trial days' },
                ] },
              ]} />
              <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/checkout-sessions \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "mode": "subscription",
    "line_items": [{ "price": "price_xxx", "quantity": 1 }],
    "success_url": "https://yoursite.com/success?session_id={CHECKOUT_SESSION_ID}",
    "cancel_url": "https://yoursite.com/canceled",
    "subscription_data": { "trial_period_days": 14 }
  }'`} />
              <CodeBlock title="Response" language="json" code={`{
  "id": "cs_xxx",
  "object": "checkout.session",
  "url": "https://atlas.io/checkout/abc123",
  "mode": "subscription",
  "status": "open",
  "expires_at": 1704931200
}`} />
            </EndpointCard>

            <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
              <h4 className="font-semibold text-white">Redirect to Checkout</h4>
              <p className="text-sm text-gray-400">After creating a session, redirect the customer to the returned URL:</p>
              <CodeBlock title="JavaScript" language="javascript" code={`const response = await fetch('/api/create-checkout', { method: 'POST' });
const { url } = await response.json();

// Redirect to hosted checkout
window.location.href = url;`} />
            </div>
          </div>

          {/* Portal Sessions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Customer Portal Sessions</h3>
            <EndpointCard method="POST" path="/portal-sessions" description="Create a portal session">
              <ParamTable params={[
                { name: 'customer', type: 'string', required: true, description: 'Customer ID' },
                { name: 'return_url', type: 'string', required: true, description: 'URL to return to after portal' },
                { name: 'configuration', type: 'object', description: 'Portal feature toggles', children: [
                  { name: 'subscription_cancel', type: 'object', description: '{ enabled: boolean }' },
                  { name: 'subscription_pause', type: 'object', description: '{ enabled: boolean }' },
                  { name: 'payment_method_update', type: 'object', description: '{ enabled: boolean }' },
                  { name: 'invoice_history', type: 'object', description: '{ enabled: boolean }' },
                ] },
              ]} />
              <CodeBlock title="Request" language="bash" code={`curl -X POST ${API_BASE}/portal-sessions \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer": "cus_xxx",
    "return_url": "https://yoursite.com/account",
    "configuration": {
      "features": {
        "subscription_cancel": { "enabled": true },
        "invoice_history": { "enabled": true }
      }
    }
  }'`} />
              <CodeBlock title="Response" language="json" code={`{
  "id": "bps_xxx",
  "object": "billing_portal.session",
  "url": "https://atlas.io/portal/xyz789",
  "customer": "cus_xxx",
  "return_url": "https://yoursite.com/account",
  "expires_at": 1704848400
}`} />
            </EndpointCard>

            <div className="rounded-xl bg-[#111] border border-white/10 p-6 space-y-4">
              <h4 className="font-semibold text-white">Portal Features</h4>
              <p className="text-sm text-gray-400">Customers can manage their billing through the portal:</p>
              <div className="grid md:grid-cols-2 gap-3 mt-4">
                {[
                  { feature: 'View subscriptions', desc: 'See all active and past subscriptions' },
                  { feature: 'Cancel subscription', desc: 'Cancel at end of billing period' },
                  { feature: 'Pause subscription', desc: 'Temporarily pause billing' },
                  { feature: 'Update payment method', desc: 'Change default card' },
                  { feature: 'View invoices', desc: 'See and download past invoices' },
                  { feature: 'Download receipts', desc: 'Get PDF receipts for payments' },
                ].map((item) => (
                  <div key={item.feature} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                    <div className="h-5 w-5 rounded bg-green-500/20 flex items-center justify-center mt-0.5">
                      <Check className="h-3 w-3 text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm text-white">{item.feature}</div>
                      <div className="text-xs text-gray-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  )
}