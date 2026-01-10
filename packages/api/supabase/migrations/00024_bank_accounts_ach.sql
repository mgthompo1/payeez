-- ============================================
-- Bank Accounts, Mandates, and ACH Transfers
-- Atlas A2A Payment Infrastructure
-- ============================================

-- Helper function for updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bank account verification methods
CREATE TYPE bank_verification_method AS ENUM (
  'manual',           -- Trust-based, B2B
  'microdeposit',     -- Two small deposits to verify
  'instant',          -- Plaid/Finicity (future)
  'open_banking'      -- UK/EU/NZ Open Banking
);

-- Bank account verification status
CREATE TYPE bank_verification_status AS ENUM (
  'unverified',
  'pending',
  'verified',
  'failed'
);

-- Bank account type
CREATE TYPE bank_account_type AS ENUM (
  'checking',
  'savings'
);

-- Mandate authorization type
CREATE TYPE mandate_auth_type AS ENUM (
  'debit',
  'credit',
  'both'
);

-- Mandate frequency
CREATE TYPE mandate_frequency AS ENUM (
  'once',
  'recurring'
);

-- Mandate status
CREATE TYPE mandate_status AS ENUM (
  'active',
  'revoked',
  'expired'
);

-- Transfer direction
CREATE TYPE transfer_direction AS ENUM (
  'debit',    -- Pull from customer
  'credit'    -- Push to customer
);

-- Transfer status
CREATE TYPE transfer_status AS ENUM (
  'pending',
  'processing',
  'settled',
  'failed',
  'returned'
);

-- Settlement provider
CREATE TYPE settlement_provider AS ENUM (
  'nacha',          -- File-based
  'stripe_ach',     -- Stripe ACH
  'dwolla',         -- Dwolla API
  'moov',           -- Moov API
  'open_banking'    -- UK/EU push payments
);

-- Country code for bank rails
CREATE TYPE bank_country AS ENUM (
  'US',   -- ACH
  'GB',   -- Faster Payments / BACS
  'NZ',   -- Direct Credit
  'EU',   -- SEPA
  'AU',   -- BECS
  'CA'    -- EFT
);

-- ============================================
-- Bank Accounts Table
-- ============================================
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Display info (always visible)
  holder_name TEXT NOT NULL,
  account_type bank_account_type NOT NULL DEFAULT 'checking',
  last4 TEXT NOT NULL,
  routing_last4 TEXT,  -- NULL for non-US
  bank_name TEXT,

  -- Encrypted in vault (reference only)
  vault_token TEXT NOT NULL,  -- Reference to encrypted data

  -- Country/rail info
  country bank_country NOT NULL DEFAULT 'US',
  currency TEXT NOT NULL DEFAULT 'USD',

  -- For US: routing number hash for duplicate detection
  routing_hash TEXT,
  account_hash TEXT,

  -- For UK/EU: sort code or IBAN info
  sort_code_last2 TEXT,
  iban_last4 TEXT,

  -- Verification
  verification_method bank_verification_method NOT NULL DEFAULT 'manual',
  verification_status bank_verification_status NOT NULL DEFAULT 'unverified',
  verified_at TIMESTAMPTZ,
  verification_attempts INT DEFAULT 0,

  -- Micro-deposit verification
  microdeposit_sent_at TIMESTAMPTZ,
  microdeposit_amount_1 INT,  -- In cents
  microdeposit_amount_2 INT,
  microdeposit_expires_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Bank Mandates Table
-- ============================================
CREATE TABLE bank_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Authorization details
  authorization_type mandate_auth_type NOT NULL DEFAULT 'debit',
  frequency mandate_frequency NOT NULL DEFAULT 'recurring',

  -- Limits
  amount_limit INT,  -- Max per transfer in cents, NULL = unlimited
  daily_limit INT,   -- Max per day
  monthly_limit INT, -- Max per month

  -- Legal proof (critical for disputes)
  authorization_text TEXT NOT NULL,
  text_version TEXT NOT NULL DEFAULT 'v1.0.0',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET NOT NULL,
  user_agent TEXT,

  -- Optional: subscription link
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Status
  status mandate_status NOT NULL DEFAULT 'active',
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  expires_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Bank Transfers Table
-- ============================================
CREATE TABLE bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  mandate_id UUID REFERENCES bank_mandates(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Transfer details
  direction transfer_direction NOT NULL,
  amount INT NOT NULL,  -- In cents
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Settlement
  settlement_provider settlement_provider NOT NULL,
  settlement_reference TEXT,  -- External reference (Stripe ID, NACHA trace, etc.)

  -- Status
  status transfer_status NOT NULL DEFAULT 'pending',
  status_detail TEXT,

  -- Timing
  initiated_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  expected_settlement_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,

  -- Return info (for ACH returns)
  return_code TEXT,
  return_reason TEXT,

  -- For NACHA batching
  nacha_batch_id UUID,
  nacha_trace_number TEXT,

  -- Risk checks
  risk_score INT,
  risk_flags JSONB DEFAULT '[]',

  -- Descriptions
  statement_descriptor TEXT,
  internal_description TEXT,

  -- Links
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NACHA Batches Table (for file-based ACH)
-- ============================================
CREATE TABLE nacha_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Batch info
  batch_number INT NOT NULL,
  file_id TEXT NOT NULL,  -- Unique file identifier

  -- Counts
  total_debits INT DEFAULT 0,
  total_credits INT DEFAULT 0,
  debit_amount INT DEFAULT 0,  -- In cents
  credit_amount INT DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, generated, submitted, processed
  generated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,

  -- File storage
  file_content TEXT,  -- The actual NACHA file content
  file_url TEXT,      -- Or S3/storage URL

  -- Return processing
  returns_file_content TEXT,
  returns_processed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Bank Account Risk Events
-- ============================================
CREATE TABLE bank_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  transfer_id UUID REFERENCES bank_transfers(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL,  -- 'return', 'velocity_exceeded', 'negative_balance', etc.
  severity TEXT NOT NULL DEFAULT 'low',  -- low, medium, high, critical

  -- Details
  description TEXT,
  details JSONB DEFAULT '{}',

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Negative Account List (known bad accounts)
-- ============================================
CREATE TABLE negative_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Account identifiers (hashed)
  routing_hash TEXT,
  account_hash TEXT,

  -- Reason
  reason TEXT NOT NULL,
  source TEXT,  -- 'internal', 'shared_network', etc.

  -- Validity
  added_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- ============================================
-- Settlement Provider Config (per profile)
-- ============================================
CREATE TABLE settlement_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Provider
  provider settlement_provider NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Credentials (encrypted reference)
  credentials_vault_token TEXT,

  -- Provider-specific config
  config JSONB DEFAULT '{}',

  -- For NACHA: originator info
  company_name TEXT,
  company_id TEXT,  -- Tax ID or assigned ID
  odfi_routing TEXT,  -- Originating bank routing
  odfi_name TEXT,

  -- For Stripe: connected account
  stripe_account_id TEXT,

  -- For Dwolla: account info
  dwolla_account_id TEXT,
  dwolla_funding_source_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, provider)
);

-- ============================================
-- Indexes
-- ============================================

-- Bank accounts
CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);
CREATE INDEX idx_bank_accounts_customer ON bank_accounts(customer_id);
CREATE INDEX idx_bank_accounts_verification ON bank_accounts(verification_status);
CREATE INDEX idx_bank_accounts_routing_hash ON bank_accounts(routing_hash);
CREATE INDEX idx_bank_accounts_account_hash ON bank_accounts(account_hash);

-- Mandates
CREATE INDEX idx_bank_mandates_tenant ON bank_mandates(tenant_id);
CREATE INDEX idx_bank_mandates_bank_account ON bank_mandates(bank_account_id);
CREATE INDEX idx_bank_mandates_status ON bank_mandates(status);

-- Transfers
CREATE INDEX idx_bank_transfers_tenant ON bank_transfers(tenant_id);
CREATE INDEX idx_bank_transfers_bank_account ON bank_transfers(bank_account_id);
CREATE INDEX idx_bank_transfers_status ON bank_transfers(status);
CREATE INDEX idx_bank_transfers_settlement_ref ON bank_transfers(settlement_reference);
CREATE INDEX idx_bank_transfers_nacha_batch ON bank_transfers(nacha_batch_id);
CREATE INDEX idx_bank_transfers_initiated ON bank_transfers(initiated_at);

-- NACHA batches
CREATE INDEX idx_nacha_batches_tenant ON nacha_batches(tenant_id);
CREATE INDEX idx_nacha_batches_status ON nacha_batches(status);

-- Risk events
CREATE INDEX idx_bank_risk_events_tenant ON bank_risk_events(tenant_id);
CREATE INDEX idx_bank_risk_events_bank_account ON bank_risk_events(bank_account_id);
CREATE INDEX idx_bank_risk_events_severity ON bank_risk_events(severity);

-- Negative accounts
CREATE INDEX idx_negative_accounts_routing ON negative_accounts(routing_hash);
CREATE INDEX idx_negative_accounts_account ON negative_accounts(account_hash);

-- Settlement config
CREATE INDEX idx_settlement_config_tenant ON settlement_config(tenant_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE nacha_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_config ENABLE ROW LEVEL SECURITY;

-- Bank accounts
CREATE POLICY "Users can view their tenant bank accounts"
  ON bank_accounts FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage bank accounts"
  ON bank_accounts FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Mandates
CREATE POLICY "Users can view their tenant mandates"
  ON bank_mandates FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage bank mandates"
  ON bank_mandates FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Transfers
CREATE POLICY "Users can view their tenant transfers"
  ON bank_transfers FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage bank transfers"
  ON bank_transfers FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- NACHA batches
CREATE POLICY "Users can view their tenant NACHA batches"
  ON nacha_batches FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage NACHA batches"
  ON nacha_batches FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Risk events
CREATE POLICY "Users can view their tenant risk events"
  ON bank_risk_events FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- Settlement config
CREATE POLICY "Users can view their tenant settlement config"
  ON settlement_config FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage settlement config"
  ON settlement_config FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- Triggers
-- ============================================

-- Update timestamp trigger
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bank_mandates_updated_at
  BEFORE UPDATE ON bank_mandates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bank_transfers_updated_at
  BEFORE UPDATE ON bank_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_nacha_batches_updated_at
  BEFORE UPDATE ON nacha_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_settlement_config_updated_at
  BEFORE UPDATE ON settlement_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Functions
-- ============================================

-- Calculate daily transfer total for a bank account
CREATE OR REPLACE FUNCTION get_daily_transfer_total(
  p_bank_account_id UUID,
  p_direction transfer_direction DEFAULT 'debit'
)
RETURNS INT AS $$
  SELECT COALESCE(SUM(amount), 0)::INT
  FROM bank_transfers
  WHERE bank_account_id = p_bank_account_id
    AND direction = p_direction
    AND status NOT IN ('failed', 'returned')
    AND initiated_at >= CURRENT_DATE
$$ LANGUAGE SQL STABLE;

-- Calculate monthly transfer total for a bank account
CREATE OR REPLACE FUNCTION get_monthly_transfer_total(
  p_bank_account_id UUID,
  p_direction transfer_direction DEFAULT 'debit'
)
RETURNS INT AS $$
  SELECT COALESCE(SUM(amount), 0)::INT
  FROM bank_transfers
  WHERE bank_account_id = p_bank_account_id
    AND direction = p_direction
    AND status NOT IN ('failed', 'returned')
    AND initiated_at >= date_trunc('month', CURRENT_DATE)
$$ LANGUAGE SQL STABLE;

-- Check if account is on negative list
CREATE OR REPLACE FUNCTION is_negative_account(
  p_routing_hash TEXT,
  p_account_hash TEXT
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM negative_accounts
    WHERE (routing_hash = p_routing_hash OR account_hash = p_account_hash)
      AND (expires_at IS NULL OR expires_at > now())
  )
$$ LANGUAGE SQL STABLE;
