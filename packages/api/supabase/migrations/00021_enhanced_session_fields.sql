-- ============================================
-- Enhanced Payment Session Fields
-- Support for PSP features: merchant reference,
-- customer data, browser info, addresses
-- ============================================

-- Add merchant reference (main order/invoice ID)
ALTER TABLE payment_sessions ADD COLUMN IF NOT EXISTS merchant_reference TEXT;

-- Add customer phone
ALTER TABLE payment_sessions ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Add browser info for 3DS/fraud prevention
ALTER TABLE payment_sessions ADD COLUMN IF NOT EXISTS browser_ip TEXT;
ALTER TABLE payment_sessions ADD COLUMN IF NOT EXISTS browser_user_agent TEXT;

-- Add billing address (for AVS)
ALTER TABLE payment_sessions ADD COLUMN IF NOT EXISTS billing_address JSONB;
-- Expected format: { street: string, city: string, state: string, postal_code: string, country: string }

-- Add shipping address (for fraud scoring)
ALTER TABLE payment_sessions ADD COLUMN IF NOT EXISTS shipping_address JSONB;
-- Expected format: { street: string, city: string, state: string, postal_code: string, country: string, recipient_name: string }

-- Add statement descriptor
ALTER TABLE payment_sessions ADD COLUMN IF NOT EXISTS statement_descriptor TEXT;

-- Add description
ALTER TABLE payment_sessions ADD COLUMN IF NOT EXISTS description TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_merchant_ref ON payment_sessions(merchant_reference) WHERE merchant_reference IS NOT NULL;

-- ============================================
-- Add columns to payment_attempts for tracking
-- ============================================

-- Add browser info to attempts (for 3DS tracking)
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS browser_ip TEXT;

-- Add 3DS result tracking
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS three_ds_version TEXT;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS three_ds_status TEXT CHECK (three_ds_status IN ('challenged', 'frictionless', 'failed', 'not_enrolled', 'unavailable'));
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS three_ds_eci TEXT;

-- Add AVS result tracking
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS avs_result TEXT;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS cvv_result TEXT;

COMMENT ON COLUMN payment_sessions.merchant_reference IS 'Merchant order/invoice ID passed to PSP';
COMMENT ON COLUMN payment_sessions.browser_ip IS 'Customer IP address for 3DS/fraud';
COMMENT ON COLUMN payment_sessions.browser_user_agent IS 'Customer user agent for 3DS/fraud';
COMMENT ON COLUMN payment_sessions.billing_address IS 'Billing address JSON for AVS';
COMMENT ON COLUMN payment_sessions.shipping_address IS 'Shipping address JSON for fraud scoring';
