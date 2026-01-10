-- ============================================
-- Atlas Native Vault + Windcave Support
-- ============================================

-- Add 'atlas' as a vault provider option
ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_vault_provider_check;
ALTER TABLE tokens ADD CONSTRAINT tokens_vault_provider_check
  CHECK (vault_provider IN ('basis_theory', 'vgs', 'atlas'));

-- Add columns for Atlas vault
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS encrypted_card_data TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS card_holder_name TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS encryption_aad TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour');
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES payment_sessions(id);

-- Add 'windcave' to PSP options in psp_credentials
ALTER TABLE psp_credentials DROP CONSTRAINT IF EXISTS psp_credentials_psp_check;
ALTER TABLE psp_credentials ADD CONSTRAINT psp_credentials_psp_check
  CHECK (psp IN ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex', 'windcave'));

-- Add 'windcave' to payment_attempts
ALTER TABLE payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_psp_check;
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_psp_check
  CHECK (psp IN ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex', 'windcave'));

-- Add 'windcave' to psp_priorities if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'psp_priorities') THEN
    ALTER TABLE psp_priorities DROP CONSTRAINT IF EXISTS psp_priorities_psp_check;
    EXECUTE 'ALTER TABLE psp_priorities ADD CONSTRAINT psp_priorities_psp_check CHECK (psp IN (''stripe'', ''adyen'', ''authorizenet'', ''chase'', ''nuvei'', ''dlocal'', ''braintree'', ''checkoutcom'', ''airwallex'', ''windcave''))';
  END IF;
END $$;

-- Add 'windcave' to traffic_split_rules if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_split_rules') THEN
    ALTER TABLE traffic_split_rules DROP CONSTRAINT IF EXISTS traffic_split_rules_psp_check;
    EXECUTE 'ALTER TABLE traffic_split_rules ADD CONSTRAINT traffic_split_rules_psp_check CHECK (psp IN (''stripe'', ''adyen'', ''authorizenet'', ''chase'', ''nuvei'', ''dlocal'', ''braintree'', ''checkoutcom'', ''airwallex'', ''windcave''))';
  END IF;
END $$;

-- Add 'windcave' to retry_rules if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'retry_rules') THEN
    ALTER TABLE retry_rules DROP CONSTRAINT IF EXISTS retry_rules_fallback_psp_check;
    -- Note: retry_rules may have different constraint names, this handles it gracefully
  END IF;
END $$;

-- Indexes for token management
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tokens_session ON tokens(session_id) WHERE session_id IS NOT NULL;

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM tokens
  WHERE expires_at < NOW()
    AND is_active = true
  RETURNING 1 INTO deleted_count;

  RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql;
