import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from '@/components/dashboard/DashboardContent'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch all transactions for the year (client will filter by time range)
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()

  const { data: allTransactions } = await supabase
    .from('payment_attempts')
    .select(`id, amount, currency, status, psp, created_at`)
    .gte('created_at', startOfYear)
    .order('created_at', { ascending: false })
    .limit(1000)

  return <DashboardContent allTransactions={allTransactions || []} />
}
