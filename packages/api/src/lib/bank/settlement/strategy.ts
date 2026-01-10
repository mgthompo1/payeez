/**
 * Settlement Strategy
 *
 * Abstraction layer for settlement decisions based on cost, speed, and liability.
 * Merchants choose outcomes, not rails.
 */

import type { BankCountry, TransferDirection } from '../types';

// ============================================
// Settlement Strategy Types
// ============================================

export type SettlementType =
  | 'nacha'           // Traditional ACH (US)
  | 'stripe_ach'      // Stripe ACH API
  | 'dwolla'          // Dwolla API
  | 'moov'            // Moov API
  | 'rtp'             // Real-Time Payments (US)
  | 'fednow'          // FedNow (US)
  | 'open_banking'    // Open Banking (UK/EU)
  | 'faster_payments' // UK Faster Payments
  | 'sepa'            // SEPA Credit Transfer
  | 'sepa_instant'    // SEPA Instant
  | 'bacs'            // UK BACS
  | 'npp'             // AU New Payments Platform
  | 'eft'             // CA Electronic Funds Transfer

export type CostBasis = 'flat' | 'percentage' | 'tiered' | 'interchange_plus';

export type ReturnLiability = 'merchant' | 'platform' | 'shared' | 'processor';

export interface BankSponsor {
  id: string;
  name: string;
  routing_number?: string;
  country: BankCountry;
  supported_rails: SettlementType[];
}

export interface SettlementStrategy {
  id: string;
  name: string;
  type: SettlementType;

  // Sponsorship
  sponsor?: BankSponsor;
  processor?: string; // e.g., 'stripe', 'dwolla', 'moov'

  // Cost model
  cost_basis: CostBasis;
  flat_fee_cents?: number;        // e.g., 25 = $0.25
  percentage_fee?: number;        // e.g., 0.8 = 0.8%
  minimum_fee_cents?: number;
  maximum_fee_cents?: number;
  monthly_fee_cents?: number;

  // Speed
  settlement_days: number;        // Business days to settle
  cutoff_time?: string;           // e.g., '16:00' ET for same-day
  supports_same_day: boolean;
  supports_instant: boolean;

  // Risk/Liability
  return_liability: ReturnLiability;
  return_window_days: number;     // How long returns can come back
  chargeback_risk: boolean;       // Can be reversed after settlement

  // Capabilities
  supported_directions: TransferDirection[];
  supported_countries: BankCountry[];
  min_amount_cents: number;
  max_amount_cents: number;

  // Requirements
  requires_mandate: boolean;
  requires_verification: boolean;
  requires_sponsor_approval: boolean;

  // Metadata
  description?: string;
  documentation_url?: string;
}

// ============================================
// Pre-configured Strategy Profiles
// ============================================

export const SETTLEMENT_STRATEGIES: Record<string, Omit<SettlementStrategy, 'id'>> = {
  // US Strategies
  nacha_standard: {
    name: 'ACH Standard (NACHA)',
    type: 'nacha',
    cost_basis: 'flat',
    flat_fee_cents: 25,
    settlement_days: 3,
    supports_same_day: false,
    supports_instant: false,
    return_liability: 'merchant',
    return_window_days: 60,
    chargeback_risk: true,
    supported_directions: ['debit', 'credit'],
    supported_countries: ['US'],
    min_amount_cents: 100,
    max_amount_cents: 100_000_00,
    requires_mandate: true,
    requires_verification: true,
    requires_sponsor_approval: true,
    description: 'Lowest cost, standard settlement. Best for B2B and bulk transfers.',
  },

  nacha_same_day: {
    name: 'ACH Same-Day (NACHA)',
    type: 'nacha',
    cost_basis: 'flat',
    flat_fee_cents: 100,
    settlement_days: 0,
    cutoff_time: '14:00',
    supports_same_day: true,
    supports_instant: false,
    return_liability: 'merchant',
    return_window_days: 60,
    chargeback_risk: true,
    supported_directions: ['debit', 'credit'],
    supported_countries: ['US'],
    min_amount_cents: 100,
    max_amount_cents: 1_000_000_00, // $1M limit for same-day
    requires_mandate: true,
    requires_verification: true,
    requires_sponsor_approval: true,
    description: 'Same-day settlement before cutoff. Higher cost but faster.',
  },

  stripe_ach_standard: {
    name: 'Stripe ACH',
    type: 'stripe_ach',
    processor: 'stripe',
    cost_basis: 'percentage',
    percentage_fee: 0.8,
    maximum_fee_cents: 500,
    settlement_days: 4,
    supports_same_day: false,
    supports_instant: false,
    return_liability: 'shared',
    return_window_days: 60,
    chargeback_risk: true,
    supported_directions: ['debit', 'credit'],
    supported_countries: ['US'],
    min_amount_cents: 100,
    max_amount_cents: 10_000_000_00,
    requires_mandate: true,
    requires_verification: true,
    requires_sponsor_approval: false,
    description: 'Stripe-managed ACH. Easy integration, shared liability.',
  },

  dwolla_standard: {
    name: 'Dwolla ACH',
    type: 'dwolla',
    processor: 'dwolla',
    cost_basis: 'flat',
    flat_fee_cents: 25,
    settlement_days: 3,
    supports_same_day: true,
    supports_instant: false,
    return_liability: 'merchant',
    return_window_days: 60,
    chargeback_risk: true,
    supported_directions: ['debit', 'credit'],
    supported_countries: ['US'],
    min_amount_cents: 100,
    max_amount_cents: 10_000_000_00,
    requires_mandate: true,
    requires_verification: true,
    requires_sponsor_approval: false,
    description: 'Dwolla white-label ACH. Good for marketplaces.',
  },

  rtp_instant: {
    name: 'RTP Instant',
    type: 'rtp',
    cost_basis: 'flat',
    flat_fee_cents: 100,
    settlement_days: 0,
    supports_same_day: true,
    supports_instant: true,
    return_liability: 'platform',
    return_window_days: 0, // Irrevocable
    chargeback_risk: false,
    supported_directions: ['credit'], // RTP is credit-push only
    supported_countries: ['US'],
    min_amount_cents: 100,
    max_amount_cents: 1_000_000_00,
    requires_mandate: false,
    requires_verification: true,
    requires_sponsor_approval: true,
    description: 'Real-time, irrevocable. Credit-push only.',
  },

  fednow_instant: {
    name: 'FedNow Instant',
    type: 'fednow',
    cost_basis: 'flat',
    flat_fee_cents: 50,
    settlement_days: 0,
    supports_same_day: true,
    supports_instant: true,
    return_liability: 'platform',
    return_window_days: 0,
    chargeback_risk: false,
    supported_directions: ['credit'],
    supported_countries: ['US'],
    min_amount_cents: 100,
    max_amount_cents: 500_000_00,
    requires_mandate: false,
    requires_verification: true,
    requires_sponsor_approval: true,
    description: 'Federal Reserve instant payments. Credit-push only.',
  },

  // UK Strategies
  faster_payments_uk: {
    name: 'UK Faster Payments',
    type: 'faster_payments',
    cost_basis: 'flat',
    flat_fee_cents: 20, // ~15p
    settlement_days: 0,
    supports_same_day: true,
    supports_instant: true,
    return_liability: 'merchant',
    return_window_days: 0,
    chargeback_risk: false,
    supported_directions: ['credit', 'debit'],
    supported_countries: ['GB'],
    min_amount_cents: 100,
    max_amount_cents: 1_000_000_00,
    requires_mandate: true,
    requires_verification: true,
    requires_sponsor_approval: true,
    description: 'UK instant payments via Open Banking.',
  },

  bacs_uk: {
    name: 'UK BACS',
    type: 'bacs',
    cost_basis: 'flat',
    flat_fee_cents: 10,
    settlement_days: 3,
    supports_same_day: false,
    supports_instant: false,
    return_liability: 'merchant',
    return_window_days: 30,
    chargeback_risk: true,
    supported_directions: ['credit', 'debit'],
    supported_countries: ['GB'],
    min_amount_cents: 100,
    max_amount_cents: 100_000_000_00,
    requires_mandate: true,
    requires_verification: true,
    requires_sponsor_approval: true,
    description: 'UK batch payments. Lowest cost, slower settlement.',
  },

  // EU Strategies
  sepa_standard: {
    name: 'SEPA Credit Transfer',
    type: 'sepa',
    cost_basis: 'flat',
    flat_fee_cents: 20,
    settlement_days: 1,
    supports_same_day: false,
    supports_instant: false,
    return_liability: 'merchant',
    return_window_days: 13,
    chargeback_risk: true,
    supported_directions: ['credit'],
    supported_countries: ['EU'],
    min_amount_cents: 100,
    max_amount_cents: 100_000_000_00,
    requires_mandate: false,
    requires_verification: true,
    requires_sponsor_approval: true,
    description: 'Standard SEPA transfers across Eurozone.',
  },

  sepa_instant: {
    name: 'SEPA Instant',
    type: 'sepa_instant',
    cost_basis: 'flat',
    flat_fee_cents: 50,
    settlement_days: 0,
    supports_same_day: true,
    supports_instant: true,
    return_liability: 'platform',
    return_window_days: 0,
    chargeback_risk: false,
    supported_directions: ['credit'],
    supported_countries: ['EU'],
    min_amount_cents: 100,
    max_amount_cents: 100_000_00,
    requires_mandate: false,
    requires_verification: true,
    requires_sponsor_approval: true,
    description: 'Instant SEPA. 10-second settlement, irrevocable.',
  },

  // AU Strategies
  npp_australia: {
    name: 'Australia NPP',
    type: 'npp',
    cost_basis: 'flat',
    flat_fee_cents: 30,
    settlement_days: 0,
    supports_same_day: true,
    supports_instant: true,
    return_liability: 'merchant',
    return_window_days: 0,
    chargeback_risk: false,
    supported_directions: ['credit'],
    supported_countries: ['AU'],
    min_amount_cents: 100,
    max_amount_cents: 1_000_000_00,
    requires_mandate: false,
    requires_verification: true,
    requires_sponsor_approval: true,
    description: 'Australian New Payments Platform. Instant PayID transfers.',
  },
};

// ============================================
// Strategy Selection
// ============================================

export interface StrategySelectionCriteria {
  country: BankCountry;
  direction: TransferDirection;
  amount_cents: number;
  priority: 'cost' | 'speed' | 'reliability';
  requires_instant?: boolean;
  max_settlement_days?: number;
  max_fee_cents?: number;
}

export interface StrategyRecommendation {
  strategy: SettlementStrategy;
  estimated_fee_cents: number;
  settlement_days: number;
  warnings: string[];
}

/**
 * Select the best settlement strategy based on criteria.
 */
export function selectSettlementStrategy(
  criteria: StrategySelectionCriteria,
  availableStrategies: SettlementStrategy[] = Object.entries(SETTLEMENT_STRATEGIES).map(
    ([id, s]) => ({ ...s, id })
  )
): StrategyRecommendation[] {
  const { country, direction, amount_cents, priority, requires_instant, max_settlement_days, max_fee_cents } = criteria;

  // Filter eligible strategies
  let eligible = availableStrategies.filter((s) => {
    if (!s.supported_countries.includes(country)) return false;
    if (!s.supported_directions.includes(direction)) return false;
    if (amount_cents < s.min_amount_cents) return false;
    if (amount_cents > s.max_amount_cents) return false;
    if (requires_instant && !s.supports_instant) return false;
    if (max_settlement_days !== undefined && s.settlement_days > max_settlement_days) return false;
    return true;
  });

  // Calculate fees and sort
  const recommendations: StrategyRecommendation[] = eligible.map((strategy) => {
    let fee = 0;

    switch (strategy.cost_basis) {
      case 'flat':
        fee = strategy.flat_fee_cents || 0;
        break;
      case 'percentage':
        fee = Math.round(amount_cents * (strategy.percentage_fee || 0) / 100);
        if (strategy.minimum_fee_cents) fee = Math.max(fee, strategy.minimum_fee_cents);
        if (strategy.maximum_fee_cents) fee = Math.min(fee, strategy.maximum_fee_cents);
        break;
      case 'tiered':
        // Would need tier lookup table
        fee = strategy.flat_fee_cents || 0;
        break;
    }

    const warnings: string[] = [];
    if (strategy.chargeback_risk) {
      warnings.push('Subject to returns/chargebacks');
    }
    if (strategy.requires_sponsor_approval) {
      warnings.push('Requires bank sponsor approval');
    }
    if (direction === 'debit' && strategy.type === 'rtp') {
      warnings.push('RTP does not support debits');
    }

    return {
      strategy,
      estimated_fee_cents: fee,
      settlement_days: strategy.settlement_days,
      warnings,
    };
  });

  // Filter by max fee if specified
  const filtered = max_fee_cents !== undefined
    ? recommendations.filter((r) => r.estimated_fee_cents <= max_fee_cents)
    : recommendations;

  // Sort by priority
  filtered.sort((a, b) => {
    switch (priority) {
      case 'cost':
        return a.estimated_fee_cents - b.estimated_fee_cents;
      case 'speed':
        return a.settlement_days - b.settlement_days;
      case 'reliability':
        // Prefer irrevocable, then lower return window
        const aScore = a.strategy.chargeback_risk ? 1 : 0;
        const bScore = b.strategy.chargeback_risk ? 1 : 0;
        if (aScore !== bScore) return aScore - bScore;
        return a.strategy.return_window_days - b.strategy.return_window_days;
      default:
        return 0;
    }
  });

  return filtered;
}

/**
 * Get strategy by ID.
 */
export function getStrategy(strategyId: string): SettlementStrategy | null {
  const strategy = SETTLEMENT_STRATEGIES[strategyId];
  if (!strategy) return null;
  return { ...strategy, id: strategyId };
}

/**
 * Get all strategies for a country.
 */
export function getStrategiesForCountry(country: BankCountry): SettlementStrategy[] {
  return Object.entries(SETTLEMENT_STRATEGIES)
    .filter(([_, s]) => s.supported_countries.includes(country))
    .map(([id, s]) => ({ ...s, id }));
}

// ============================================
// Cost Estimation
// ============================================

export interface CostEstimate {
  strategy_id: string;
  strategy_name: string;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  settlement_days: number;
  is_instant: boolean;
}

/**
 * Estimate costs for a transfer across all eligible strategies.
 */
export function estimateCosts(
  country: BankCountry,
  direction: TransferDirection,
  amount_cents: number
): CostEstimate[] {
  const strategies = getStrategiesForCountry(country).filter(
    (s) => s.supported_directions.includes(direction)
  );

  return strategies
    .filter((s) => amount_cents >= s.min_amount_cents && amount_cents <= s.max_amount_cents)
    .map((strategy) => {
      let fee = 0;

      switch (strategy.cost_basis) {
        case 'flat':
          fee = strategy.flat_fee_cents || 0;
          break;
        case 'percentage':
          fee = Math.round(amount_cents * (strategy.percentage_fee || 0) / 100);
          if (strategy.minimum_fee_cents) fee = Math.max(fee, strategy.minimum_fee_cents);
          if (strategy.maximum_fee_cents) fee = Math.min(fee, strategy.maximum_fee_cents);
          break;
      }

      return {
        strategy_id: strategy.id,
        strategy_name: strategy.name,
        amount_cents,
        fee_cents: fee,
        net_amount_cents: direction === 'debit' ? amount_cents - fee : amount_cents,
        settlement_days: strategy.settlement_days,
        is_instant: strategy.supports_instant,
      };
    })
    .sort((a, b) => a.fee_cents - b.fee_cents);
}
