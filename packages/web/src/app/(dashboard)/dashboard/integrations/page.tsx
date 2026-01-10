import { redirect } from 'next/navigation'

// Integrations have been moved to Settings > Integrations tab
export default function IntegrationsPage() {
  redirect('/dashboard/settings?tab=integrations')
}
