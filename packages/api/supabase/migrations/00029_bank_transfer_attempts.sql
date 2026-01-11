-- ============================================
-- Bank Transfer Attempts & Events (ACH Audit Trail)
-- Mirrors payment_attempts pattern for card payments
-- ============================================

-- Transfer attempt tracking (like payment_attempts for cards)
CREATE TABLE bank_transfer_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES bank_transfers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES bank_mandates(id),

  -- Provider execution
  settlement_provider settlement_provider NOT NULL,
  provider_reference TEXT,

  -- Attempt tracking
  attempt_number INT NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL UNIQUE,

  -- Denormalized for audit (immutable record of what was attempted)
  amount INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  direction transfer_direction NOT NULL,

  -- Status machine (ACH-specific states)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'processing', 'settled', 'failed', 'returned', 'canceled')),

  -- Failure tracking
  failure_code TEXT,
  failure_message TEXT,
  failure_category TEXT,  -- 'account_error', 'bank_error', 'network_error', etc.

  -- ACH return tracking (can happen days after settlement)
  return_code TEXT,       -- R01, R02, ... R99
  return_reason TEXT,
  is_reversible_window_open BOOLEAN DEFAULT false,

  -- Provider response
  raw_response JSONB,

  -- Timing (ACH lifecycle)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  estimated_settlement_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ
);

-- Transfer events (webhook + internal state machine log)
CREATE TABLE bank_transfer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transfer_id UUID NOT NULL REFERENCES bank_transfers(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES bank_transfer_attempts(id),

  -- Event details
  event_type TEXT NOT NULL,  -- 'transfer.submitted', 'transfer.settled', 'transfer.returned', etc.
  provider TEXT,
  provider_event_id TEXT,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add routing explanation to transfers (strategy explainability)
ALTER TABLE bank_transfers ADD COLUMN IF NOT EXISTS routing_strategy TEXT;
ALTER TABLE bank_transfers ADD COLUMN IF NOT EXISTS routing_reason JSONB;

-- Add verification tracking fields to bank_accounts
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS verification_method TEXT
  CHECK (verification_method IS NULL OR verification_method IN ('micro_deposits', 'financial_connections', 'instant', 'manual'));
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS verification_strength TEXT
  CHECK (verification_strength IS NULL OR verification_strength IN ('basic', 'strong'));
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS verification_evidence_ref TEXT;

-- Indexes for efficient lookups
CREATE INDEX idx_bta_transfer ON bank_transfer_attempts(transfer_id);
CREATE INDEX idx_bta_provider_ref ON bank_transfer_attempts(provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX idx_bta_status ON bank_transfer_attempts(status) WHERE status NOT IN ('settled', 'failed', 'returned');
CREATE INDEX idx_bta_idempotency ON bank_transfer_attempts(idempotency_key);

CREATE INDEX idx_bte_transfer ON bank_transfer_events(transfer_id);
CREATE INDEX idx_bte_attempt ON bank_transfer_events(attempt_id) WHERE attempt_id IS NOT NULL;
CREATE INDEX idx_bte_type ON bank_transfer_events(event_type);

-- RLS
ALTER TABLE bank_transfer_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transfer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant transfer attempts"
  ON bank_transfer_attempts FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Users can view their tenant transfer events"
  ON bank_transfer_events FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- Trigger for updated_at
CREATE TRIGGER update_bank_transfer_attempts_updated_at
  BEFORE UPDATE ON bank_transfer_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
