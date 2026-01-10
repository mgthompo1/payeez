-- ============================================
-- Bank Module Enhancements
-- Settlement Strategy, Account Capabilities, Mandate Engine
-- ============================================

-- ============================================
-- Mandate Scope Type
-- ============================================

CREATE TYPE mandate_scope AS ENUM (
  'single',      -- One-time authorization
  'recurring',   -- Ongoing with schedule
  'standing',    -- Open-ended (variable amount/timing)
  'blanket'      -- Pre-authorized up to limits
);

-- ============================================
-- Settlement Strategy Type
-- ============================================

CREATE TYPE settlement_type AS ENUM (
  'nacha',
  'stripe_ach',
  'dwolla',
  'moov',
  'rtp',
  'fednow',
  'open_banking',
  'faster_payments',
  'sepa',
  'sepa_instant',
  'bacs',
  'npp',
  'eft'
);

-- ============================================
-- Verification Level Type
-- ============================================

CREATE TYPE verification_level AS ENUM (
  'none',
  'basic',
  'verified',
  'enhanced'
);

-- ============================================
-- Enhance bank_mandates table
-- ============================================

ALTER TABLE bank_mandates
  ADD COLUMN IF NOT EXISTS scope mandate_scope DEFAULT 'recurring',
  ADD COLUMN IF NOT EXISTS rail settlement_type,
  ADD COLUMN IF NOT EXISTS country bank_country DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS revocable boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revocation_reason text,
  ADD COLUMN IF NOT EXISTS sepa_mandate_id text,
  ADD COLUMN IF NOT EXISTS bacs_ddi_reference text,
  ADD COLUMN IF NOT EXISTS ach_company_id text,
  ADD COLUMN IF NOT EXISTS schedule jsonb,
  ADD COLUMN IF NOT EXISTS authorization_data jsonb,
  ADD COLUMN IF NOT EXISTS effective_date timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS total_transfers integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS limits jsonb DEFAULT '{}';

-- Update limits column to use the enhanced structure
COMMENT ON COLUMN bank_mandates.limits IS 'MandateLimits JSON: max_amount_cents, daily_limit_cents, monthly_limit_cents, max_transfers_per_day, etc.';

-- ============================================
-- Account Capabilities table
-- ============================================

CREATE TABLE IF NOT EXISTS bank_account_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

  -- Core capabilities
  can_debit boolean DEFAULT false,
  can_credit boolean DEFAULT true,

  -- Supported rails
  supported_rails settlement_type[] DEFAULT '{}',

  -- Verification
  verified boolean DEFAULT false,
  verified_via text,
  verification_level verification_level DEFAULT 'none',

  -- Limits
  debit_limit_cents bigint,
  credit_limit_cents bigint,
  daily_limit_cents bigint,

  -- Restrictions
  restrictions text[] DEFAULT '{}',

  -- Timestamps
  last_verified_at timestamptz,
  capabilities_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  -- One capability record per account
  UNIQUE(bank_account_id)
);

-- Index for capability lookups
CREATE INDEX IF NOT EXISTS idx_capabilities_account ON bank_account_capabilities(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_verified ON bank_account_capabilities(verified) WHERE verified = true;

-- ============================================
-- Settlement Strategies table
-- ============================================

CREATE TABLE IF NOT EXISTS settlement_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Strategy identity
  name text NOT NULL,
  type settlement_type NOT NULL,

  -- Sponsorship
  sponsor_name text,
  sponsor_routing_number text,
  processor text,  -- 'stripe', 'dwolla', 'moov', etc.

  -- Cost model
  cost_basis text NOT NULL DEFAULT 'flat',  -- flat, percentage, tiered
  flat_fee_cents integer,
  percentage_fee decimal(5,4),
  minimum_fee_cents integer,
  maximum_fee_cents integer,

  -- Speed
  settlement_days integer NOT NULL DEFAULT 3,
  cutoff_time time,
  supports_same_day boolean DEFAULT false,
  supports_instant boolean DEFAULT false,

  -- Risk
  return_liability text DEFAULT 'merchant',  -- merchant, platform, shared, processor
  return_window_days integer DEFAULT 60,
  chargeback_risk boolean DEFAULT true,

  -- Capabilities
  supported_directions text[] DEFAULT '{debit,credit}',
  supported_countries bank_country[] DEFAULT '{US}',
  min_amount_cents bigint DEFAULT 100,
  max_amount_cents bigint DEFAULT 10000000,

  -- Requirements
  requires_mandate boolean DEFAULT true,
  requires_verification boolean DEFAULT true,
  requires_sponsor_approval boolean DEFAULT false,

  -- Status
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,

  -- Metadata
  description text,
  documentation_url text,
  metadata jsonb DEFAULT '{}',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_strategies_tenant ON settlement_strategies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_strategies_type ON settlement_strategies(type);
CREATE INDEX IF NOT EXISTS idx_strategies_active ON settlement_strategies(is_active) WHERE is_active = true;

-- ============================================
-- Verification Sessions table
-- ============================================

CREATE TABLE IF NOT EXISTS verification_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

  -- Provider info
  provider text NOT NULL,  -- 'manual', 'microdeposit', 'plaid', 'finicity', etc.
  provider_session_id text,

  -- Status
  status text NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, failed, expired

  -- Results
  verified boolean DEFAULT false,
  verification_level verification_level,

  -- Additional data from provider
  account_holder_name text,
  account_type text,
  institution_name text,
  institution_id text,
  balance_available_cents bigint,
  balance_current_cents bigint,

  -- URLs/tokens
  redirect_url text,
  link_token text,
  widget_url text,

  -- Timestamps
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz,

  -- Metadata
  metadata jsonb DEFAULT '{}',
  error_message text,
  error_code text,

  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verification_account ON verification_sessions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_sessions(status);
CREATE INDEX IF NOT EXISTS idx_verification_provider ON verification_sessions(provider);

-- ============================================
-- Helper Functions
-- ============================================

-- Increment mandate usage
CREATE OR REPLACE FUNCTION increment_mandate_usage(
  p_mandate_id uuid,
  p_amount bigint
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE bank_mandates
  SET
    total_transfers = total_transfers + 1,
    total_amount_cents = total_amount_cents + p_amount,
    last_used_at = now(),
    updated_at = now()
  WHERE id = p_mandate_id;
END;
$$;

-- Auto-update capabilities when account verification changes
CREATE OR REPLACE FUNCTION sync_account_capabilities()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert or update capabilities when verification status changes
  INSERT INTO bank_account_capabilities (
    bank_account_id,
    can_debit,
    can_credit,
    verified,
    verified_via,
    verification_level,
    capabilities_updated_at
  )
  VALUES (
    NEW.id,
    NEW.verification_status = 'verified',
    true,
    NEW.verification_status = 'verified',
    NEW.verification_method,
    CASE
      WHEN NEW.verification_status = 'verified' THEN 'verified'::verification_level
      WHEN NEW.verification_status = 'pending' THEN 'basic'::verification_level
      ELSE 'none'::verification_level
    END,
    now()
  )
  ON CONFLICT (bank_account_id) DO UPDATE SET
    can_debit = NEW.verification_status = 'verified',
    verified = NEW.verification_status = 'verified',
    verified_via = NEW.verification_method,
    verification_level = CASE
      WHEN NEW.verification_status = 'verified' THEN 'verified'::verification_level
      WHEN NEW.verification_status = 'pending' THEN 'basic'::verification_level
      ELSE 'none'::verification_level
    END,
    last_verified_at = CASE WHEN NEW.verification_status = 'verified' THEN now() ELSE bank_account_capabilities.last_verified_at END,
    capabilities_updated_at = now();

  RETURN NEW;
END;
$$;

-- Create trigger for capability sync
DROP TRIGGER IF EXISTS trigger_sync_capabilities ON bank_accounts;
CREATE TRIGGER trigger_sync_capabilities
  AFTER INSERT OR UPDATE OF verification_status, verification_method
  ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_account_capabilities();

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE bank_account_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_sessions ENABLE ROW LEVEL SECURITY;

-- Capabilities: accessible via bank account ownership
CREATE POLICY capabilities_select ON bank_account_capabilities
  FOR SELECT
  USING (
    bank_account_id IN (
      SELECT id FROM bank_accounts WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

-- Strategies: tenant-owned
CREATE POLICY strategies_select ON settlement_strategies
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY strategies_manage ON settlement_strategies
  FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Verification sessions: accessible via bank account ownership
CREATE POLICY verification_select ON verification_sessions
  FOR SELECT
  USING (
    bank_account_id IN (
      SELECT id FROM bank_accounts WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

CREATE POLICY verification_insert ON verification_sessions
  FOR INSERT
  WITH CHECK (
    bank_account_id IN (
      SELECT id FROM bank_accounts
      WHERE tenant_id IN (
        SELECT m.tenant_id FROM memberships m
        JOIN users u ON m.user_id = u.id
        WHERE u.auth_id = auth.uid()::TEXT
          AND m.role IN ('owner', 'admin')
      )
    )
  );

-- ============================================
-- Add settlement_strategy_id to transfers
-- ============================================

ALTER TABLE bank_transfers
  ADD COLUMN IF NOT EXISTS settlement_strategy_id uuid REFERENCES settlement_strategies(id);

CREATE INDEX IF NOT EXISTS idx_transfers_strategy ON bank_transfers(settlement_strategy_id);
