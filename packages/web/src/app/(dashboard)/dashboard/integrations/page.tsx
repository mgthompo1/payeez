import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, Puzzle, Smartphone } from 'lucide-react'

const integrationStatusStyles: Record<string, string> = {
  available: 'bg-green-500/10 text-green-400 border-green-500/20',
  scaffold: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  planned: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

export default function IntegrationsPage() {
  const commerceIntegrations = [
    {
      name: 'WooCommerce',
      status: 'scaffold',
      description: 'Drop-in gateway plugin with Atlas sessions + tokenization. Supports cards, Apple Pay, Google Pay, and subscriptions.',
      path: 'packages/integrations/atlas-woocommerce',
    },
    {
      name: 'Salesforce Commerce Cloud',
      status: 'scaffold',
      description: 'SFRA cartridge with payment sessions, 3DS, webhooks, and saved cards for B2C Commerce.',
      path: 'packages/integrations/atlas-salesforce-commerce-cloud',
    },
    {
      name: 'Salesforce OMS',
      status: 'scaffold',
      description: 'Apex classes, LWC component, and webhooks for Salesforce Order Management payments.',
      path: 'packages/integrations/atlas-salesforce-oms',
    },
    {
      name: 'Shopware 6',
      status: 'scaffold',
      description: 'Payment app scaffold with checkout and admin configuration for Atlas.',
      path: 'packages/integrations/shopware',
    },
  ]

  const mobileIntegrations = [
    {
      name: 'iOS (Swift)',
      status: 'planned',
      description: 'Native drop-in components for Apple Pay + card tokenization.',
    },
    {
      name: 'React Native',
      status: 'planned',
      description: 'Cross-platform drop-in UI with Atlas Elements + token handling.',
    },
    {
      name: 'Flutter',
      status: 'planned',
      description: 'Flutter plugin for Atlas Elements and confirmation flow.',
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-gray-500 mt-1">Scaffolds and starter kits for common platforms.</p>
        </div>
        <Badge className="bg-white/5 text-gray-300 border-white/10 flex items-center gap-2">
          <Puzzle className="h-3 w-3" />
          Platform kits
        </Badge>
      </div>

      <div className="rounded-2xl bg-[#111] border border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Package className="h-5 w-5 text-[#19d1c3]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Commerce platforms</h2>
            <p className="text-sm text-gray-500">Use these scaffolds to ship Atlas on day one.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {commerceIntegrations.map((integration) => (
            <div key={integration.name} className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">{integration.name}</div>
                <Badge className={integrationStatusStyles[integration.status] || 'bg-white/5 text-gray-300'}>
                  {integration.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">{integration.description}</p>
              <div className="text-xs text-gray-400">
                <span className="uppercase tracking-wide">Path</span>: <code className="text-[#19d1c3]">{integration.path}</code>
              </div>
              <Button variant="outline" className="w-full border-white/10 text-gray-300 hover:bg-white/5" disabled={integration.status !== 'available'}>
                {integration.status === 'available' ? 'Open guide' : 'Scaffold ready'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-[#111] border border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-[#c8ff5a]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Mobile drop-in SDKs</h2>
            <p className="text-sm text-gray-500">Native components with tokenization and confirmation flows.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {mobileIntegrations.map((integration) => (
            <div key={integration.name} className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">{integration.name}</div>
                <Badge className={integrationStatusStyles[integration.status] || 'bg-white/5 text-gray-300'}>
                  {integration.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">{integration.description}</p>
              <Button variant="outline" className="w-full border-white/10 text-gray-300 hover:bg-white/5" disabled>
                Planned
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-[#0c131b] via-[#0a0f14] to-[#0c131b] border border-white/10 p-6 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-white">Need a custom integration?</div>
          <div className="text-sm text-gray-500">We can build bespoke adapters for ERPs, PSPs, and commerce platforms.</div>
        </div>
        <Button className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
          Contact support
        </Button>
      </div>
    </div>
  )
}