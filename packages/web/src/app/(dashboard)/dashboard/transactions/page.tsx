'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Download, Filter } from 'lucide-react'

// Mock data for initial display
const mockTransactions = [
  {
    id: 'py_1234567890',
    amount: 4990,
    currency: 'USD',
    status: 'succeeded',
    psp: 'stripe',
    customer_email: 'customer@example.com',
    created_at: new Date().toISOString(),
  },
]

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [transactions, setTransactions] = useState<typeof mockTransactions>([])
  const [loading, setLoading] = useState(false)

  const searchTransactions = async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('payment_attempts')
      .select(`
        id,
        amount,
        currency,
        status,
        psp,
        psp_transaction_id,
        created_at,
        payment_sessions (
          customer_email,
          external_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (searchQuery) {
      query = query.or(`psp_transaction_id.ilike.%${searchQuery}%,id.eq.${searchQuery}`)
    }

    const { data, error } = await query

    if (!error && data) {
      setTransactions(data.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        psp: t.psp,
        customer_email: t.payment_sessions?.customer_email,
        created_at: t.created_at,
      })))
    }

    setLoading(false)
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      succeeded: 'default',
      captured: 'default',
      authorized: 'secondary',
      pending: 'outline',
      failed: 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-gray-500">View and search payment transactions</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by transaction ID, email, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && searchTransactions()}
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            <Button onClick={searchTransactions} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            {transactions.length} transactions found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PSP</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No transactions found. Use the search to find specific transactions.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono text-sm">
                      {transaction.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {formatAmount(transaction.amount, transaction.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{transaction.psp}</Badge>
                    </TableCell>
                    <TableCell>{transaction.customer_email || '-'}</TableCell>
                    <TableCell>{formatDate(transaction.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
