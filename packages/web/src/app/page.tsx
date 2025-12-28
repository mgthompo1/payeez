import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, CreditCard, Shield, Zap, Globe } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-semibold text-lg">Payeez</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900">
              Sign in
            </Link>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
          Payment orchestration
          <br />
          <span className="text-blue-600">without the complexity</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Route payments to any processor, capture cards securely with Basis Theory,
          and never worry about PCI compliance again.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/signup">
              Start for free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/docs">View docs</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need for payments
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-xl border">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Multi-PSP Support</h3>
              <p className="text-gray-600">
                Connect Stripe, Adyen, Braintree, Checkout.com, and more with a single integration.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border">
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">PCI-Free</h3>
              <p className="text-gray-600">
                Card data is tokenized by Basis Theory. You never touch sensitive data.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border">
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Smart Routing</h3>
              <p className="text-gray-600">
                Route payments by currency, amount, card type, or any custom logic.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border">
              <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Global Coverage</h3>
              <p className="text-gray-600">
                Accept payments worldwide with processors optimized for each region.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Simple integration
              </h2>
              <p className="text-gray-600 mb-6">
                Create a payment session on your server, mount our SDK on your checkout page,
                and we handle the rest.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <span>Drop-in payment form</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <span>Automatic PSP selection</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                  <span>Normalized webhooks</span>
                </li>
              </ul>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 text-sm">
              <pre className="text-gray-300 overflow-x-auto">
{`// Server: Create a payment session
const session = await fetch('/api/payeez/sessions', {
  method: 'POST',
  body: JSON.stringify({
    amount: 4990,
    currency: 'USD',
  }),
});

// Client: Mount the payment form
Payeez.mount({
  sessionId: session.id,
  clientSecret: session.client_secret,
  elementId: 'payment-form',
  onSuccess: (payment) => {
    window.location = '/success';
  },
});`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to simplify your payments?
          </h2>
          <p className="text-blue-100 mb-8">
            Get started in minutes. No credit card required.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/signup">
              Create free account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">P</span>
            </div>
            <span className="text-sm text-gray-600">© 2024 Payeez</span>
          </div>
          <nav className="flex gap-6 text-sm text-gray-600">
            <Link href="/docs" className="hover:text-gray-900">Docs</Link>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            <Link href="/support" className="hover:text-gray-900">Support</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
