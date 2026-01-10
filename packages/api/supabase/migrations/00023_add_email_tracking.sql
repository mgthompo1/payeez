-- Add email tracking columns for billing notifications
-- Migration: 00023_add_email_tracking.sql

-- Add trial reminder sent timestamp to subscriptions
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS trial_reminder_sent TIMESTAMPTZ;

-- Note: amount_remaining and amount_paid are already defined in 00022_subscriptions_and_billing.sql
-- amount_remaining is a generated column computed as (amount_due - amount_paid)

-- Create index for trial reminder queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_reminder
ON subscriptions (status, trial_end, trial_reminder_sent)
WHERE status = 'trialing';

-- Add invoice number column if not exists
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS number TEXT;

-- Create sequence for invoice numbers per tenant
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  invoice_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO invoice_count
  FROM invoices
  WHERE tenant_id = NEW.tenant_id;

  NEW.number := 'INV-' || LPAD(invoice_count::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating invoice numbers
DROP TRIGGER IF EXISTS set_invoice_number ON invoices;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.number IS NULL)
  EXECUTE FUNCTION generate_invoice_number();

-- Add hosted_invoice_url column for invoice payment links
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS hosted_invoice_url TEXT;

COMMENT ON COLUMN subscriptions.trial_reminder_sent IS 'Timestamp when trial ending reminder email was sent';
COMMENT ON COLUMN invoices.number IS 'Human-readable invoice number (e.g., INV-000001)';
COMMENT ON COLUMN invoices.hosted_invoice_url IS 'URL for hosted invoice payment page';
