import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptJson } from './crypto.ts';

export interface RouteDecision {
  psp: string;
  reason: string;
  credentials: Record<string, string>;
}

interface RoutingConditions {
  currency?: string;
  amount_gte?: number;
  amount_lte?: number;
  card_brand?: string;
}

/**
 * Determine which PSP to route a payment to
 */
export async function routePayment(
  tenantId: string,
  amount: number,
  currency: string,
  environment: 'test' | 'live',
  supabase: SupabaseClient
): Promise<RouteDecision | null> {
  // 1. Get active routing rules for tenant, ordered by priority
  const { data: rules, error: rulesError } = await supabase
    .from('routing_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (rulesError) {
    console.error('Error fetching routing rules:', rulesError);
  }

  // 2. Find matching rule
  let selectedPsp: string | null = null;
  let reason = 'default';

  for (const rule of rules || []) {
    if (matchesConditions(rule.conditions, { amount, currency })) {
      selectedPsp = rule.psp;
      reason = `matched rule ${rule.id} (priority ${rule.priority})`;
      break;
    }
  }

  // 3. If no rule matched, use first active PSP credential
  if (!selectedPsp) {
    const { data: creds } = await supabase
      .from('psp_credentials')
      .select('psp')
      .eq('tenant_id', tenantId)
      .eq('environment', environment)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (creds) {
      selectedPsp = creds.psp;
      reason = 'first available PSP';
    }
  }

  if (!selectedPsp) {
    return null;
  }

  // 4. Fetch credentials for selected PSP
  const { data: credData, error: credError } = await supabase
    .from('psp_credentials')
    .select('credentials_encrypted')
    .eq('tenant_id', tenantId)
    .eq('psp', selectedPsp)
    .eq('environment', environment)
    .eq('is_active', true)
    .single();

  if (credError || !credData) {
    console.error('Error fetching PSP credentials:', credError);
    return null;
  }

  let credentials: Record<string, string>;
  try {
    credentials = (await decryptJson(credData.credentials_encrypted)) as Record<string, string>;
  } catch (error) {
    console.error('Failed to decrypt PSP credentials:', error);
    return null;
  }

  return {
    psp: selectedPsp,
    reason,
    credentials,
  };
}

function matchesConditions(
  conditions: RoutingConditions,
  context: { amount: number; currency: string }
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true; // Empty conditions = always match
  }

  if (conditions.currency && conditions.currency !== context.currency) {
    return false;
  }

  if (conditions.amount_gte && context.amount < conditions.amount_gte) {
    return false;
  }

  if (conditions.amount_lte && context.amount > conditions.amount_lte) {
    return false;
  }

  return true;
}
