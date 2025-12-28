'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Plus, Trash2, ArrowRight, RefreshCw, Percent, AlertTriangle, Activity, GitBranch, Zap, Check, X } from 'lucide-react'

const PSP_OPTIONS = [
  { value: 'stripe', label: 'Stripe', color: 'from-[#19d1c3] to-[#4cc3ff]' },
  { value: 'adyen', label: 'Adyen', color: 'from-green-500 to-emerald-500' },
  { value: 'authorizenet', label: 'Authorize.net', color: 'from-blue-500 to-cyan-500' },
  { value: 'chase', label: 'Chase', color: 'from-blue-600 to-blue-800' },
  { value: 'nuvei', label: 'Nuvei', color: 'from-orange-500 to-red-500' },
  { value: 'dlocal', label: 'dLocal', color: 'from-teal-500 to-green-500' },
  { value: 'braintree', label: 'Braintree', color: 'from-pink-500 to-rose-500' },
  { value: 'checkoutcom', label: 'Checkout.com', color: 'from-indigo-500 to-[#4cc3ff]' },
  { value: 'airwallex', label: 'Airwallex', color: 'from-red-500 to-orange-500' },
]

interface TrafficRule {
  id: string
  psp: string
  weight: number
  conditions: Record<string, unknown> | null
  is_active: boolean
}

interface RetryRule {
  id: string
  source_psp: string
  target_psp: string
  retry_order: number
  failure_codes: string[] | null
  max_retries: number
  is_active: boolean
}

interface PSPPriority {
  id: string
  psp: string
  priority: number
  is_healthy: boolean
  avg_latency_ms: number | null
  success_rate: number | null
  is_active: boolean
}

interface OrchestrationProfile {
  id: string
  tenant_id: string
  name: string
  description: string | null
  is_active: boolean
  is_default: boolean
}

export default function OrchestrationPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<OrchestrationProfile | null>(null)
  const [trafficRules, setTrafficRules] = useState<TrafficRule[]>([])
  const [retryRules, setRetryRules] = useState<RetryRule[]>([])
  const [pspPriorities, setPspPriorities] = useState<PSPPriority[]>([])
  const [showTrafficDialog, setShowTrafficDialog] = useState(false)
  const [showRetryDialog, setShowRetryDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<'traffic' | 'retry' | 'health'>('traffic')
  const [newTrafficRule, setNewTrafficRule] = useState({ psp: '', weight: 25 })
  const [newRetryRule, setNewRetryRule] = useState({
    source_psp: '',
    target_psp: '',
    failure_codes: [] as string[],
    max_retries: 1,
  })

  const supabase = createClient()

  useEffect(() => {
    loadOrchestration()
  }, [])

  async function loadOrchestration() {
    const { data: profiles } = await supabase
      .from('orchestration_profiles')
      .select('*')
      .eq('is_default', true)
      .limit(1)
      .single()

    let currentProfile = profiles

    if (!currentProfile) {
      const { data: newProfile } = await supabase
        .from('orchestration_profiles')
        .insert({
          name: 'Default Profile',
          environment: 'test',
          is_active: true,
          is_default: true,
        })
        .select()
        .single()
      currentProfile = newProfile
    }

    if (currentProfile) {
      setProfile(currentProfile)

      const { data: traffic } = await supabase
        .from('traffic_split_rules')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('weight', { ascending: false })

      setTrafficRules(traffic || [])

      const { data: retries } = await supabase
        .from('retry_rules')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('source_psp', { ascending: true })

      setRetryRules(retries || [])

      const { data: priorities } = await supabase
        .from('psp_priorities')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('priority', { ascending: true })

      setPspPriorities(priorities || [])
    }

    setLoading(false)
  }

  async function addTrafficRule() {
    if (profile && newTrafficRule.psp) {
      await supabase.from('traffic_split_rules').insert({
        profile_id: profile.id,
        tenant_id: profile.tenant_id,
        psp: newTrafficRule.psp,
        weight: newTrafficRule.weight,
        is_active: true,
      })
      setShowTrafficDialog(false)
      setNewTrafficRule({ psp: '', weight: 25 })
      loadOrchestration()
    }
  }

  async function toggleTrafficRule(id: string, is_active: boolean) {
    await supabase.from('traffic_split_rules').update({ is_active }).eq('id', id)
    loadOrchestration()
  }

  async function updateTrafficWeight(id: string, weight: number) {
    await supabase.from('traffic_split_rules').update({ weight }).eq('id', id)
    loadOrchestration()
  }

  async function deleteTrafficRule(id: string) {
    await supabase.from('traffic_split_rules').delete().eq('id', id)
    loadOrchestration()
  }

  async function addRetryRule() {
    if (profile && newRetryRule.source_psp && newRetryRule.target_psp) {
      await supabase.from('retry_rules').insert({
        profile_id: profile.id,
        tenant_id: profile.tenant_id,
        source_psp: newRetryRule.source_psp,
        target_psp: newRetryRule.target_psp,
        failure_codes: newRetryRule.failure_codes.length > 0 ? newRetryRule.failure_codes : null,
        max_retries: newRetryRule.max_retries,
        retry_order: 1,
        is_active: true,
      })
      setShowRetryDialog(false)
      setNewRetryRule({ source_psp: '', target_psp: '', failure_codes: [], max_retries: 1 })
      loadOrchestration()
    }
  }

  async function toggleRetryRule(id: string, is_active: boolean) {
    await supabase.from('retry_rules').update({ is_active }).eq('id', id)
    loadOrchestration()
  }

  async function deleteRetryRule(id: string) {
    await supabase.from('retry_rules').delete().eq('id', id)
    loadOrchestration()
  }

  const totalWeight = trafficRules.filter((r) => r.is_active).reduce((sum, r) => sum + r.weight, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#19d1c3]" />
      </div>
    )
  }

  const tabs = [
    { id: 'traffic', label: 'Traffic Split', icon: Percent },
    { id: 'retry', label: 'Retry Rules', icon: RefreshCw },
    { id: 'health', label: 'PSP Health', icon: Activity },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payment Orchestration</h1>
          <p className="text-gray-500 mt-1">Configure traffic routing, retries, and failover rules</p>
        </div>
        <Badge className={`${profile?.is_active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400'}`}>
          {profile?.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#19d1c3]/10 text-[#19d1c3] border border-[#19d1c3]/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Traffic Split */}
      {activeTab === 'traffic' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Traffic Distribution</h2>
                <p className="text-sm text-gray-500">Distribute payment traffic across processors</p>
              </div>
              <Dialog open={showTrafficDialog} onOpenChange={setShowTrafficDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Processor
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#111] border-white/10">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add Traffic Split Rule</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Add a processor to the traffic distribution
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Processor</Label>
                      <Select
                        value={newTrafficRule.psp}
                        onValueChange={(v) => setNewTrafficRule({ ...newTrafficRule, psp: v })}
                      >
                        <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                          <SelectValue placeholder="Select processor" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-white/10">
                          {PSP_OPTIONS.filter(
                            (p) => !trafficRules.find((r) => r.psp === p.value)
                          ).map((psp) => (
                            <SelectItem key={psp.value} value={psp.value} className="text-white focus:bg-white/10">
                              {psp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Traffic Weight: {newTrafficRule.weight}%</Label>
                      <Slider
                        value={[newTrafficRule.weight]}
                        onValueChange={([v]) => setNewTrafficRule({ ...newTrafficRule, weight: v })}
                        max={100}
                        step={5}
                        className="py-2"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowTrafficDialog(false)} className="border-white/10 text-gray-300 hover:bg-white/5">
                      Cancel
                    </Button>
                    <Button onClick={addTrafficRule} className="bg-[#19d1c3] hover:bg-[#3be3d2]">Add Rule</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {trafficRules.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <GitBranch className="h-6 w-6 text-gray-500" />
                </div>
                <p className="text-gray-400 mb-2">No traffic rules configured</p>
                <p className="text-sm text-gray-500">Add processors to distribute payment traffic</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Visual distribution bar */}
                <div className="h-10 rounded-xl overflow-hidden flex bg-[#0a0a0a]">
                  {trafficRules
                    .filter((r) => r.is_active)
                    .map((rule) => {
                      const pspConfig = PSP_OPTIONS.find((p) => p.value === rule.psp)
                      const pct = totalWeight > 0 ? (rule.weight / totalWeight) * 100 : 0
                      return (
                        <div
                          key={rule.id}
                          className={`bg-gradient-to-r ${pspConfig?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white text-xs font-medium transition-all`}
                          style={{ width: `${pct}%` }}
                        >
                          {pct >= 12 && `${pspConfig?.label} ${Math.round(pct)}%`}
                        </div>
                      )
                    })}
                </div>

                {totalWeight !== 100 && (
                  <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Total weight is {totalWeight}%. Weights will be normalized to 100%.
                    </span>
                  </div>
                )}

                {/* Rule list */}
                <div className="space-y-3">
                  {trafficRules.map((rule) => {
                    const pspConfig = PSP_OPTIONS.find((p) => p.value === rule.psp)
                    return (
                      <div
                        key={rule.id}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          rule.is_active
                            ? 'bg-white/5 border-white/10'
                            : 'bg-white/[0.02] border-white/5 opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={(v) => toggleTrafficRule(rule.id, v)}
                          />
                          <div className={`h-10 w-10 rounded-lg bg-gradient-to-r ${pspConfig?.color} flex items-center justify-center`}>
                            <Zap className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{pspConfig?.label}</p>
                            <p className="text-sm text-gray-500">
                              {rule.conditions ? `Conditional routing` : 'All transactions'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-32">
                            <Slider
                              value={[rule.weight]}
                              onValueChange={([v]) => updateTrafficWeight(rule.id, v)}
                              max={100}
                              step={5}
                              disabled={!rule.is_active}
                            />
                          </div>
                          <span className="text-sm text-gray-400 w-12 text-right">{rule.weight}%</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTrafficRule(rule.id)}
                            className="text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retry Rules */}
      {activeTab === 'retry' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Failover Rules</h2>
                <p className="text-sm text-gray-500">Configure automatic retries when a processor fails</p>
              </div>
              <Dialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-[#19d1c3] to-[#c8ff5a] hover:opacity-90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#111] border-white/10">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add Retry Rule</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Configure failover when a processor fails
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">If this fails...</Label>
                      <Select
                        value={newRetryRule.source_psp}
                        onValueChange={(v) => setNewRetryRule({ ...newRetryRule, source_psp: v })}
                      >
                        <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                          <SelectValue placeholder="Select processor" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-white/10">
                          {PSP_OPTIONS.map((psp) => (
                            <SelectItem key={psp.value} value={psp.value} className="text-white focus:bg-white/10">
                              {psp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Retry with...</Label>
                      <Select
                        value={newRetryRule.target_psp}
                        onValueChange={(v) => setNewRetryRule({ ...newRetryRule, target_psp: v })}
                      >
                        <SelectTrigger className="bg-[#0a0a0a] border-white/10 text-white">
                          <SelectValue placeholder="Select processor" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-white/10">
                          {PSP_OPTIONS.filter((p) => p.value !== newRetryRule.source_psp).map((psp) => (
                            <SelectItem key={psp.value} value={psp.value} className="text-white focus:bg-white/10">
                              {psp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Max Retries: {newRetryRule.max_retries}</Label>
                      <Slider
                        value={[newRetryRule.max_retries]}
                        onValueChange={([v]) => setNewRetryRule({ ...newRetryRule, max_retries: v })}
                        max={5}
                        min={1}
                        step={1}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowRetryDialog(false)} className="border-white/10 text-gray-300 hover:bg-white/5">
                      Cancel
                    </Button>
                    <Button onClick={addRetryRule} className="bg-[#19d1c3] hover:bg-[#3be3d2]">Add Rule</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {retryRules.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="h-6 w-6 text-gray-500" />
                </div>
                <p className="text-gray-400 mb-2">No retry rules configured</p>
                <p className="text-sm text-gray-500">Add rules to automatically retry failed payments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {retryRules.map((rule) => {
                  const sourcePsp = PSP_OPTIONS.find((p) => p.value === rule.source_psp)
                  const targetPsp = PSP_OPTIONS.find((p) => p.value === rule.target_psp)
                  return (
                    <div
                      key={rule.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        rule.is_active
                          ? 'bg-white/5 border-white/10'
                          : 'bg-white/[0.02] border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(v) => toggleRetryRule(rule.id, v)}
                        />
                        <div className={`h-8 w-8 rounded-lg bg-gradient-to-r ${sourcePsp?.color} flex items-center justify-center`}>
                          <span className="text-xs font-bold text-white">{sourcePsp?.label.charAt(0)}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-500" />
                        <div className={`h-8 w-8 rounded-lg bg-gradient-to-r ${targetPsp?.color} flex items-center justify-center`}>
                          <span className="text-xs font-bold text-white">{targetPsp?.label.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {sourcePsp?.label} → {targetPsp?.label}
                          </p>
                          <p className="text-sm text-gray-500">
                            Max {rule.max_retries} {rule.max_retries === 1 ? 'retry' : 'retries'}
                            {rule.failure_codes && ` • ${rule.failure_codes.length} failure codes`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRetryRule(rule.id)}
                        className="text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PSP Health */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#111] border border-white/10 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white">Processor Health</h2>
              <p className="text-sm text-gray-500">Real-time health metrics for each processor</p>
            </div>

            {pspPriorities.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Activity className="h-6 w-6 text-gray-500" />
                </div>
                <p className="text-gray-400 mb-2">No health data available</p>
                <p className="text-sm text-gray-500">Health metrics will appear once payments are processed</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pspPriorities.map((psp) => {
                  const pspConfig = PSP_OPTIONS.find((p) => p.value === psp.psp)
                  return (
                    <div
                      key={psp.id}
                      className="p-4 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg bg-gradient-to-r ${pspConfig?.color} flex items-center justify-center`}>
                            <Zap className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{pspConfig?.label}</p>
                            <p className="text-xs text-gray-500">Priority {psp.priority}</p>
                          </div>
                        </div>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          psp.is_healthy ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          {psp.is_healthy ? (
                            <Check className="h-4 w-4 text-green-400" />
                          ) : (
                            <X className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Success Rate</p>
                          <p className="text-lg font-semibold text-white">
                            {psp.success_rate ? `${psp.success_rate.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Avg Latency</p>
                          <p className="text-lg font-semibold text-white">
                            {psp.avg_latency_ms ? `${psp.avg_latency_ms}ms` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
