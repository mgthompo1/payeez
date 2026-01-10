// ============================================
// Payment Orchestration Engine
// Handles weighted routing, retries, and failover
// ============================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptJson } from './crypto.ts';
import { fetchPSPCredentials } from './psp.ts';

export interface RouteContext {
  tenantId: string;
  sessionId: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  cardBrand?: string;
  country?: string;
  environment: 'test' | 'live';
}

export interface RouteDecision {
  psp: string;
  credentials: Record<string, unknown>;
  profileId?: string;
  reason: 'weighted_random' | 'retry' | 'failover' | 'condition_match' | 'default' | 'forced';
  candidates: Array<{ psp: string; weight: number }>;
  isRetry: boolean;
  retryNumber?: number;
  previousPsp?: string;
  previousFailureCode?: string;
}

export interface RetryContext {
  failedPsp: string;
  failureCode?: string;
  failureCategory?: string;
  attemptNumber: number;
}

/**
 * Orchestration Engine
 * Manages PSP selection based on traffic rules, retries, and failover
 */
export class Orchestrator {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Select a PSP for initial payment attempt
   */
  async selectPSP(context: RouteContext): Promise<RouteDecision | null> {
    // 1. Get active orchestration profile
    const profile = await this.getActiveProfile(context.tenantId, context.environment);

    if (!profile) {
      // Fall back to legacy routing
      return await this.legacyRoute(context);
    }

    // 2. Get matching traffic split rules
    const candidates = await this.getMatchingRules(profile.id, context);

    if (candidates.length === 0) {
      return await this.legacyRoute(context);
    }

    // 3. Select PSP using weighted random
    const selectedPsp = this.weightedRandomSelect(candidates);

    if (!selectedPsp) {
      return null;
    }

    // 4. Get credentials for selected PSP
    const credentials = await this.getPSPCredentials(
      context.tenantId,
      selectedPsp,
      context.environment
    );

    if (!credentials) {
      // PSP not configured, try next candidate
      const fallback = await this.selectFallback(candidates, selectedPsp, context);
      if (fallback) return fallback;
      return null;
    }

    // 5. Log routing decision
    await this.logDecision({
      tenantId: context.tenantId,
      sessionId: context.sessionId,
      profileId: profile.id,
      selectedPsp,
      reason: 'weighted_random',
      candidates,
      isRetry: false,
      amount: context.amount,
      currency: context.currency,
      paymentMethod: context.paymentMethod,
      cardBrand: context.cardBrand,
    });

    return {
      psp: selectedPsp,
      credentials,
      profileId: profile.id,
      reason: 'weighted_random',
      candidates,
      isRetry: false,
    };
  }

  /**
   * Select a PSP using a specific orchestration profile
   */
  async selectPSPWithProfile(
    profileId: string,
    context: RouteContext
  ): Promise<RouteDecision | null> {
    const candidates = await this.getMatchingRules(profileId, context);

    if (candidates.length === 0) {
      return null;
    }

    const selectedPsp = this.weightedRandomSelect(candidates);
    if (!selectedPsp) {
      return null;
    }

    const credentials = await this.getPSPCredentials(
      context.tenantId,
      selectedPsp,
      context.environment
    );

    if (!credentials) {
      return null;
    }

    await this.logDecision({
      tenantId: context.tenantId,
      sessionId: context.sessionId,
      profileId,
      selectedPsp,
      reason: 'weighted_random',
      candidates,
      isRetry: false,
      amount: context.amount,
      currency: context.currency,
      paymentMethod: context.paymentMethod,
      cardBrand: context.cardBrand,
    });

    return {
      psp: selectedPsp,
      credentials,
      profileId,
      reason: 'weighted_random',
      candidates,
      isRetry: false,
    };
  }

  /**
   * Select a PSP for retry after failure
   */
  async selectRetryPSP(
    context: RouteContext,
    retryContext: RetryContext
  ): Promise<RouteDecision | null> {
    // 1. Get active profile
    const profile = await this.getActiveProfile(context.tenantId, context.environment);

    if (!profile) {
      return null; // No retry without orchestration profile
    }

    // 2. Get retry rules for failed PSP
    const retryRules = await this.getRetryRules(
      profile.id,
      retryContext.failedPsp,
      retryContext.failureCode
    );

    if (retryRules.length === 0) {
      // No retry rules, try failover based on priority
      return await this.selectFailoverPSP(context, retryContext, profile.id);
    }

    // 3. Find next retry target based on attempt number
    const applicableRule = retryRules.find(
      (r) => r.retry_order === retryContext.attemptNumber
    );

    if (!applicableRule) {
      return await this.selectFailoverPSP(context, retryContext, profile.id);
    }

    // 4. Check if we've exceeded max retries
    if (retryContext.attemptNumber > applicableRule.max_retries) {
      return await this.selectFailoverPSP(context, retryContext, profile.id);
    }

    // 5. Get credentials for retry PSP
    const credentials = await this.getPSPCredentials(
      context.tenantId,
      applicableRule.target_psp,
      context.environment
    );

    if (!credentials) {
      return await this.selectFailoverPSP(context, retryContext, profile.id);
    }

    // 6. Log retry decision
    await this.logDecision({
      tenantId: context.tenantId,
      sessionId: context.sessionId,
      profileId: profile.id,
      selectedPsp: applicableRule.target_psp,
      reason: 'retry',
      candidates: [{ psp: applicableRule.target_psp, weight: 100 }],
      isRetry: true,
      retryNumber: retryContext.attemptNumber,
      previousPsp: retryContext.failedPsp,
      previousFailureCode: retryContext.failureCode,
      amount: context.amount,
      currency: context.currency,
      paymentMethod: context.paymentMethod,
      cardBrand: context.cardBrand,
    });

    return {
      psp: applicableRule.target_psp,
      credentials,
      profileId: profile.id,
      reason: 'retry',
      candidates: [{ psp: applicableRule.target_psp, weight: 100 }],
      isRetry: true,
      retryNumber: retryContext.attemptNumber,
      previousPsp: retryContext.failedPsp,
      previousFailureCode: retryContext.failureCode,
    };
  }

  /**
   * Select PSP based on priority for failover
   */
  private async selectFailoverPSP(
    context: RouteContext,
    retryContext: RetryContext,
    profileId: string
  ): Promise<RouteDecision | null> {
    // Get PSP priorities, excluding failed PSP
    const { data: priorities } = await this.supabase
      .from('psp_priorities')
      .select('psp, priority')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .eq('is_healthy', true)
      .neq('psp', retryContext.failedPsp)
      .order('priority', { ascending: true })
      .limit(5);

    if (!priorities || priorities.length === 0) {
      return null;
    }

    // Try each PSP in priority order
    for (const p of priorities) {
      const credentials = await this.getPSPCredentials(
        context.tenantId,
        p.psp,
        context.environment
      );

      if (credentials) {
        await this.logDecision({
          tenantId: context.tenantId,
          sessionId: context.sessionId,
          profileId,
          selectedPsp: p.psp,
          reason: 'failover',
          candidates: priorities.map((pp) => ({ psp: pp.psp, weight: 100 - pp.priority })),
          isRetry: true,
          retryNumber: retryContext.attemptNumber,
          previousPsp: retryContext.failedPsp,
          previousFailureCode: retryContext.failureCode,
          amount: context.amount,
          currency: context.currency,
          paymentMethod: context.paymentMethod,
          cardBrand: context.cardBrand,
        });

        return {
          psp: p.psp,
          credentials,
          profileId,
          reason: 'failover',
          candidates: priorities.map((pp) => ({ psp: pp.psp, weight: 100 - pp.priority })),
          isRetry: true,
          retryNumber: retryContext.attemptNumber,
          previousPsp: retryContext.failedPsp,
          previousFailureCode: retryContext.failureCode,
        };
      }
    }

    return null;
  }

  /**
   * Get active orchestration profile for tenant
   */
  private async getActiveProfile(
    tenantId: string,
    environment: string
  ): Promise<{ id: string; name: string } | null> {
    const { data } = await this.supabase
      .from('orchestration_profiles')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('environment', environment)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    return data;
  }

  /**
   * Get matching traffic split rules
   */
  private async getMatchingRules(
    profileId: string,
    context: RouteContext
  ): Promise<Array<{ psp: string; weight: number }>> {
    const { data: rules } = await this.supabase
      .from('traffic_split_rules')
      .select('psp, weight, conditions, priority')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (!rules) return [];

    // Filter rules by conditions
    const matchingRules = rules.filter((rule) => {
      if (!rule.conditions) return true;

      const c = rule.conditions as Record<string, unknown>;

      if (c.currency && c.currency !== context.currency) return false;
      if (c.payment_method && c.payment_method !== context.paymentMethod) return false;
      if (c.card_brand && c.card_brand !== context.cardBrand) return false;
      if (c.amount_gte && context.amount < (c.amount_gte as number)) return false;
      if (c.amount_lte && context.amount > (c.amount_lte as number)) return false;

      return true;
    });

    return matchingRules.map((r) => ({ psp: r.psp, weight: r.weight }));
  }

  /**
   * Get retry rules for a failed PSP
   */
  private async getRetryRules(
    profileId: string,
    sourcePsp: string,
    failureCode?: string
  ): Promise<
    Array<{
      target_psp: string;
      retry_order: number;
      max_retries: number;
      retry_delay_ms: number;
      failure_codes: string[] | null;
    }>
  > {
    const { data: rules } = await this.supabase
      .from('retry_rules')
      .select('target_psp, retry_order, max_retries, retry_delay_ms, failure_codes')
      .eq('profile_id', profileId)
      .eq('source_psp', sourcePsp)
      .eq('is_active', true)
      .order('retry_order', { ascending: true });

    if (!rules) return [];

    // Filter by failure code if specified
    return rules.filter((rule) => {
      if (!rule.failure_codes) return true; // null = any failure
      if (!failureCode) return true; // no specific failure code, match any
      return rule.failure_codes.includes(failureCode);
    });
  }

  /**
   * Weighted random selection from candidates
   */
  private weightedRandomSelect(
    candidates: Array<{ psp: string; weight: number }>
  ): string | null {
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);

    if (totalWeight === 0) return null;

    const random = Math.random() * totalWeight;
    let cumulative = 0;

    for (const candidate of candidates) {
      cumulative += candidate.weight;
      if (random <= cumulative) {
        return candidate.psp;
      }
    }

    return candidates[0]?.psp || null;
  }

  /**
   * Select fallback when primary selection fails
   */
  private async selectFallback(
    candidates: Array<{ psp: string; weight: number }>,
    excludePsp: string,
    context: RouteContext
  ): Promise<RouteDecision | null> {
    const remaining = candidates.filter((c) => c.psp !== excludePsp);

    for (const candidate of remaining.sort((a, b) => b.weight - a.weight)) {
      const credentials = await this.getPSPCredentials(
        context.tenantId,
        candidate.psp,
        context.environment
      );

      if (credentials) {
        return {
          psp: candidate.psp,
          credentials,
          reason: 'failover',
          candidates: remaining,
          isRetry: false,
        };
      }
    }

    return null;
  }

  /**
   * Legacy routing for backwards compatibility
   */
  private async legacyRoute(context: RouteContext): Promise<RouteDecision | null> {
    // Try to get credentials from psp_credentials table
    // Use whatever environment is configured in the PSP credential itself
    const { data: creds } = await this.supabase
      .from('psp_credentials')
      .select('psp, credentials_encrypted, environment')
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!creds) return null;

    try {
      const decryptedCreds = await decryptJson(creds.credentials_encrypted || '{}') || {};
      // Include the PSP credential's environment so adapters know which endpoint to use
      return {
        psp: creds.psp,
        credentials: {
          ...decryptedCreds,
          environment: creds.environment,
        },
        reason: 'default',
        candidates: [{ psp: creds.psp, weight: 100 }],
        isRetry: false,
      };
    } catch (error) {
      console.error('Failed to decrypt PSP credentials:', error);
      return null;
    }
  }

  /**
   * Get PSP credentials
   */
  private async getPSPCredentials(
    tenantId: string,
    psp: string,
    environment: string
  ): Promise<Record<string, unknown> | null> {
    return await fetchPSPCredentials(
      this.supabase,
      tenantId,
      psp,
      environment
    );
  }

  /**
   * Log a forced PSP selection for analytics
   */
  async logForcedDecision(
    context: RouteContext,
    psp: string,
    profileId?: string
  ): Promise<void> {
    await this.logDecision({
      tenantId: context.tenantId,
      sessionId: context.sessionId,
      profileId,
      selectedPsp: psp,
      reason: 'forced',
      candidates: [{ psp, weight: 100 }],
      isRetry: false,
      amount: context.amount,
      currency: context.currency,
      paymentMethod: context.paymentMethod,
      cardBrand: context.cardBrand,
    });
  }

  /**
   * Log routing decision for analytics
   */
  private async logDecision(params: {
    tenantId: string;
    sessionId: string;
    profileId?: string;
    selectedPsp: string;
    reason: string;
    candidates: Array<{ psp: string; weight: number }>;
    isRetry: boolean;
    retryNumber?: number;
    previousPsp?: string;
    previousFailureCode?: string;
    amount?: number;
    currency?: string;
    paymentMethod?: string;
    cardBrand?: string;
  }): Promise<void> {
    try {
      await this.supabase.from('routing_decisions').insert({
        tenant_id: params.tenantId,
        session_id: params.sessionId,
        profile_id: params.profileId,
        selected_psp: params.selectedPsp,
        selection_reason: params.reason,
        candidates: params.candidates,
        is_retry: params.isRetry,
        retry_number: params.retryNumber,
        previous_psp: params.previousPsp,
        previous_failure_code: params.previousFailureCode,
        amount: params.amount,
        currency: params.currency,
        payment_method: params.paymentMethod,
        card_brand: params.cardBrand,
        outcome: 'pending',
      });
    } catch (err) {
      console.error('Failed to log routing decision:', err);
    }
  }

  /**
   * Update routing decision outcome
   */
  async updateDecisionOutcome(
    sessionId: string,
    outcome: 'success' | 'failure'
  ): Promise<void> {
    await this.supabase
      .from('routing_decisions')
      .update({
        outcome,
        outcome_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .is('outcome', null);
  }

  /**
   * Update PSP health metrics
   */
  async updatePSPMetrics(
    profileId: string,
    psp: string,
    success: boolean,
    latencyMs: number
  ): Promise<void> {
    const update: Record<string, unknown> = {
      last_health_check: new Date().toISOString(),
    };

    if (success) {
      update.last_success_at = new Date().toISOString();
    } else {
      update.last_failure_at = new Date().toISOString();
    }

    // Simple exponential moving average for latency
    const { data: current } = await this.supabase
      .from('psp_priorities')
      .select('avg_latency_ms, success_rate')
      .eq('profile_id', profileId)
      .eq('psp', psp)
      .single();

    if (current) {
      const alpha = 0.1; // smoothing factor
      update.avg_latency_ms = current.avg_latency_ms
        ? Math.round(alpha * latencyMs + (1 - alpha) * current.avg_latency_ms)
        : latencyMs;

      // Update success rate (simple moving average over ~100 samples)
      const successValue = success ? 100 : 0;
      update.success_rate = current.success_rate
        ? (0.99 * current.success_rate + 0.01 * successValue).toFixed(2)
        : successValue;
    }

    await this.supabase
      .from('psp_priorities')
      .update(update)
      .eq('profile_id', profileId)
      .eq('psp', psp);
  }
}

/**
 * Create orchestrator instance
 */
export function createOrchestrator(supabase: SupabaseClient): Orchestrator {
  return new Orchestrator(supabase);
}
