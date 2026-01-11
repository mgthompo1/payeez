-- ============================================
-- ACH/Bank Account Fixes
-- 1. Add 'cancelled' to transfer_status enum
-- 2. Add unique index on bank_transfers.idempotency_key
-- 3. Add idempotency_key column if missing
-- ============================================

-- Add 'cancelled' to transfer_status enum
ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Add idempotency_key column to bank_transfers if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transfers' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE bank_transfers ADD COLUMN idempotency_key TEXT;
  END IF;
END $$;

-- Add unique index on idempotency_key (partial - only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transfers_idempotency_key
  ON bank_transfers(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Add failure columns if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transfers' AND column_name = 'failure_code'
  ) THEN
    ALTER TABLE bank_transfers ADD COLUMN failure_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transfers' AND column_name = 'failure_reason'
  ) THEN
    ALTER TABLE bank_transfers ADD COLUMN failure_reason TEXT;
  END IF;
END $$;

-- Add provider_transfer_id for external reference (Stripe charge ID, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transfers' AND column_name = 'provider_transfer_id'
  ) THEN
    ALTER TABLE bank_transfers ADD COLUMN provider_transfer_id TEXT;
  END IF;
END $$;

-- Index for provider lookups
CREATE INDEX IF NOT EXISTS idx_bank_transfers_provider_id
  ON bank_transfers(provider_transfer_id)
  WHERE provider_transfer_id IS NOT NULL;
