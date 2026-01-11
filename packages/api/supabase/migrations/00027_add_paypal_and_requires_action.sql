-- ============================================
-- Add PayPal PSP Support + requires_action Status
-- ============================================

-- Add 'paypal' to PSP options in psp_credentials
ALTER TABLE psp_credentials DROP CONSTRAINT IF EXISTS psp_credentials_psp_check;
ALTER TABLE psp_credentials ADD CONSTRAINT psp_credentials_psp_check
  CHECK (psp IN ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex', 'windcave', 'paypal'));

-- Add 'paypal' to payment_attempts PSP constraint
ALTER TABLE payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_psp_check;
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_psp_check
  CHECK (psp IN ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex', 'windcave', 'paypal'));

-- Add 'requires_action' to payment_attempts status constraint
-- This status is used when 3DS/redirect flow is required
ALTER TABLE payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_status_check;
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_status_check
  CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'canceled', 'refunded', 'requires_action'));

-- Add 'requires_action' to payment_sessions status constraint (for consistency)
ALTER TABLE payment_sessions DROP CONSTRAINT IF EXISTS payment_sessions_status_check;
ALTER TABLE payment_sessions ADD CONSTRAINT payment_sessions_status_check
  CHECK (status IN ('pending', 'requires_payment_method', 'requires_action', 'processing', 'succeeded', 'failed', 'canceled'));

-- Add 'paypal' to routing_rules
ALTER TABLE routing_rules DROP CONSTRAINT IF EXISTS routing_rules_psp_check;
ALTER TABLE routing_rules ADD CONSTRAINT routing_rules_psp_check
  CHECK (psp IN ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex', 'windcave', 'paypal'));

-- Add 'paypal' to psp_priorities if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'psp_priorities') THEN
    ALTER TABLE psp_priorities DROP CONSTRAINT IF EXISTS psp_priorities_psp_check;
    EXECUTE 'ALTER TABLE psp_priorities ADD CONSTRAINT psp_priorities_psp_check CHECK (psp IN (''stripe'', ''adyen'', ''authorizenet'', ''chase'', ''nuvei'', ''dlocal'', ''braintree'', ''checkoutcom'', ''airwallex'', ''windcave'', ''paypal''))';
  END IF;
END $$;

-- Add 'paypal' to traffic_split_rules if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'traffic_split_rules') THEN
    ALTER TABLE traffic_split_rules DROP CONSTRAINT IF EXISTS traffic_split_rules_psp_check;
    EXECUTE 'ALTER TABLE traffic_split_rules ADD CONSTRAINT traffic_split_rules_psp_check CHECK (psp IN (''stripe'', ''adyen'', ''authorizenet'', ''chase'', ''nuvei'', ''dlocal'', ''braintree'', ''checkoutcom'', ''airwallex'', ''windcave'', ''paypal''))';
  END IF;
END $$;

-- Add 'paypal' to retry_rules if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'retry_rules') THEN
    ALTER TABLE retry_rules DROP CONSTRAINT IF EXISTS retry_rules_fallback_psp_check;
    EXECUTE 'ALTER TABLE retry_rules ADD CONSTRAINT retry_rules_fallback_psp_check CHECK (fallback_psp IN (''stripe'', ''adyen'', ''authorizenet'', ''chase'', ''nuvei'', ''dlocal'', ''braintree'', ''checkoutcom'', ''airwallex'', ''windcave'', ''paypal''))';
  END IF;
END $$;
