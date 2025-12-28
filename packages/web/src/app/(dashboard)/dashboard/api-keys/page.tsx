'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Copy, Eye, EyeOff, Trash2 } from 'lucide-react'

export default function ApiKeysPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  // Mock API keys
  const [apiKeys] = useState([
    {
      id: '1',
      label: 'Production Key',
      prefix: 'sk_live_',
      environment: 'live',
      lastUsed: '2 hours ago',
      created: 'Dec 20, 2024',
    },
    {
      id: '2',
      label: 'Test Key',
      prefix: 'sk_test_',
      environment: 'test',
      lastUsed: '5 minutes ago',
      created: 'Dec 15, 2024',
    },
  ])

  const handleCreateKey = () => {
    // In production, this would call the API
    const mockKey = 'sk_test_' + Math.random().toString(36).substring(2, 34)
    setNewKeyValue(mockKey)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-gray-500">Manage your API keys for authentication</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for authenticating requests
              </DialogDescription>
            </DialogHeader>
            {!newKeyValue ? (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="label">Label</Label>
                    <Input
                      id="label"
                      placeholder="e.g., Production Server"
                      value={newKeyLabel}
                      onChange={(e) => setNewKeyLabel(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey}>Create Key</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium">
                      Save this key now - you won&apos;t be able to see it again!
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Your new API key</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={newKeyValue}
                        readOnly
                        className="font-mono"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(newKeyValue)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setShowCreateDialog(false)
                      setNewKeyValue(null)
                      setNewKeyLabel('')
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Keys</CardTitle>
          <CardDescription>
            Keys are used to authenticate API requests. Keep them secret!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.label}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {key.prefix}...
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.environment === 'live' ? 'default' : 'secondary'}>
                      {key.environment}
                    </Badge>
                  </TableCell>
                  <TableCell>{key.lastUsed}</TableCell>
                  <TableCell>{key.created}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
