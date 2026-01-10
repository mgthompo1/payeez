-- ============================================
-- Subscriptions & Billing System
-- Stripe-like subscription management with
-- products, prices, invoices, and hosted pages
-- ============================================

-- ============================================
-- 1. CUSTOMERS
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,

  -- Contact info
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  description TEXT,

  -- Payment
  default_token_id UUID REFERENCES tokens(id) ON DELETE SET NULL,

  -- Addresses
  billing_address JSONB,
  shipping_address JSONB,

  -- Tax
  tax_exempt BOOLEAN DEFAULT FALSE,
  tax_ids JSONB DEFAULT '[]', -- [{type: 'eu_vat', value: 'DE123456789'}]

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_email ON customers(tenant_id, email);

-- ============================================
-- 2. PRODUCTS
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,

  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  -- Display on statements
  statement_descriptor TEXT,

  -- For usage-based products
  unit_label TEXT, -- 'seat', 'user', 'GB', etc.

  -- Images (array of URLs)
  images JSONB DEFAULT '[]',

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_tenant ON products(tenant_id, is_active);

-- ============================================
-- 3. PRICES
-- ============================================

CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,

  -- Pricing model
  type TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  billing_scheme TEXT NOT NULL DEFAULT 'per_unit'
    CHECK (billing_scheme IN ('per_unit', 'tiered')),

  -- Amount (in cents, null for tiered)
  currency TEXT NOT NULL,
  unit_amount INT,

  -- Recurring configuration
  recurring_interval TEXT CHECK (recurring_interval IN ('day', 'week', 'month', 'year')),
  recurring_interval_count INT DEFAULT 1 CHECK (recurring_interval_count >= 1),
  recurring_usage_type TEXT DEFAULT 'licensed'
    CHECK (recurring_usage_type IN ('licensed', 'metered')),
  recurring_aggregate_usage TEXT
    CHECK (recurring_aggregate_usage IN ('sum', 'max', 'last_during_period', 'last_ever')),

  -- Tiered pricing
  tiers JSONB, -- [{up_to: 10, unit_amount: 1000}, {up_to: null, unit_amount: 800}]
  tiers_mode TEXT CHECK (tiers_mode IN ('graduated', 'volume')),

  -- Trial
  trial_period_days INT,

  -- Tax
  tax_behavior TEXT DEFAULT 'unspecified'
    CHECK (tax_behavior IN ('inclusive', 'exclusive', 'unspecified')),
  tax_rate_percent DECIMAL(5,2) DEFAULT 0,

  -- Display
  nickname TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prices_product ON prices(product_id, is_active);
CREATE INDEX idx_prices_tenant ON prices(tenant_id, is_active);

-- ============================================
-- 4. SUBSCRIPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN (
    'incomplete',          -- Payment pending for first invoice
    'incomplete_expired',  -- First invoice payment failed after 23 hours
    'trialing',           -- In trial period
    'active',             -- Paid and active
    'past_due',           -- Payment failed but grace period active
    'canceled',           -- Canceled by merchant or customer
    'unpaid',             -- All retries exhausted
    'paused'              -- Temporarily paused
  )),

  -- Billing cycle
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  billing_cycle_anchor TIMESTAMPTZ, -- Day of month/year for billing

  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  trial_settings JSONB, -- {end_behavior: 'create_invoice' | 'pause' | 'cancel'}

  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancellation_comment TEXT,

  -- Payment
  default_token_id UUID REFERENCES tokens(id) ON DELETE SET NULL,
  collection_method TEXT DEFAULT 'charge_automatically'
    CHECK (collection_method IN ('charge_automatically', 'send_invoice')),
  days_until_due INT DEFAULT 30,

  -- Billing thresholds
  billing_thresholds JSONB, -- {amount_gte: 10000, reset_billing_cycle_anchor: false}

  -- Pause configuration
  pause_collection JSONB, -- {behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void', resumes_at: timestamp}

  -- Proration
  proration_behavior TEXT DEFAULT 'create_prorations'
    CHECK (proration_behavior IN ('create_prorations', 'none', 'always_invoice')),

  -- Latest invoice reference
  latest_invoice_id UUID,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(tenant_id, status)
  WHERE status NOT IN ('canceled', 'incomplete_expired');
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end)
  WHERE status IN ('active', 'trialing', 'past_due');

-- ============================================
-- 5. SUBSCRIPTION ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  price_id UUID REFERENCES prices(id) NOT NULL,

  quantity INT DEFAULT 1 CHECK (quantity >= 0),

  -- Billing thresholds for this item
  billing_thresholds JSONB, -- {usage_gte: 1000}

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_items_subscription ON subscription_items(subscription_id);

-- ============================================
-- 6. USAGE RECORDS
-- ============================================

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_item_id UUID REFERENCES subscription_items(id) ON DELETE CASCADE NOT NULL,

  quantity INT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action TEXT DEFAULT 'increment' CHECK (action IN ('increment', 'set')),

  idempotency_key TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (idempotency_key)
);

CREATE INDEX idx_usage_records_item ON usage_records(subscription_item_id, timestamp DESC);

-- ============================================
-- 7. INVOICES
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Invoice number (auto-generated)
  number TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',         -- Being built
    'open',          -- Finalized, awaiting payment
    'paid',          -- Payment received
    'uncollectible', -- Marked as uncollectible
    'void'           -- Voided
  )),

  -- Amounts (all in cents)
  currency TEXT NOT NULL,
  subtotal INT NOT NULL DEFAULT 0,
  tax INT DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  amount_due INT NOT NULL DEFAULT 0,
  amount_paid INT DEFAULT 0,
  amount_remaining INT GENERATED ALWAYS AS (amount_due - amount_paid) STORED,

  -- Discounts
  total_discount_amount INT DEFAULT 0,

  -- Billing period (for subscription invoices)
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- Payment configuration
  collection_method TEXT DEFAULT 'charge_automatically',
  days_until_due INT DEFAULT 30,
  due_date TIMESTAMPTZ,

  -- Payment tracking
  payment_attempt_id UUID REFERENCES payment_attempts(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,

  -- Finalization
  finalized_at TIMESTAMPTZ,
  auto_advance BOOLEAN DEFAULT TRUE,

  -- URLs for hosted pages
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,

  -- Customer info snapshot
  customer_email TEXT,
  customer_name TEXT,
  customer_address JSONB,

  -- Billing reason
  billing_reason TEXT CHECK (billing_reason IN (
    'subscription_create',
    'subscription_cycle',
    'subscription_update',
    'subscription_threshold',
    'manual',
    'upcoming'
  )),

  -- Footer and memo
  footer TEXT,
  description TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status) WHERE status IN ('open', 'draft');
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status = 'open';

-- Add foreign key for subscription's latest invoice (after invoices table exists)
ALTER TABLE subscriptions
  ADD CONSTRAINT fk_subscriptions_latest_invoice
  FOREIGN KEY (latest_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- ============================================
-- 8. INVOICE LINE ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  subscription_item_id UUID REFERENCES subscription_items(id) ON DELETE SET NULL,
  price_id UUID REFERENCES prices(id) ON DELETE SET NULL,

  type TEXT NOT NULL CHECK (type IN ('subscription', 'invoiceitem')),
  description TEXT NOT NULL,

  -- Amounts
  currency TEXT NOT NULL,
  unit_amount INT,
  quantity INT DEFAULT 1,
  amount INT NOT NULL, -- unit_amount * quantity

  -- Period covered (for subscription lines)
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- Proration
  proration BOOLEAN DEFAULT FALSE,
  proration_details JSONB,

  -- Discounts applied
  discount_amounts JSONB DEFAULT '[]', -- [{discount_id, amount}]

  -- Tax
  tax_amounts JSONB DEFAULT '[]', -- [{tax_rate_id, amount}]

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- ============================================
-- 9. COUPONS
-- ============================================

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,

  name TEXT NOT NULL,
  code TEXT, -- Promo code, optional

  -- Discount type
  type TEXT NOT NULL CHECK (type IN ('percent_off', 'amount_off')),
  percent_off DECIMAL(5,2) CHECK (percent_off > 0 AND percent_off <= 100),
  amount_off INT CHECK (amount_off > 0),
  currency TEXT, -- Required for amount_off

  -- Duration
  duration TEXT NOT NULL CHECK (duration IN ('once', 'repeating', 'forever')),
  duration_in_months INT, -- For 'repeating'

  -- Restrictions
  max_redemptions INT,
  times_redeemed INT DEFAULT 0,
  applies_to JSONB, -- {products: [product_ids], prices: [price_ids]}

  -- Validity
  valid BOOLEAN DEFAULT TRUE,
  redeem_by TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupons_tenant ON coupons(tenant_id);
CREATE INDEX idx_coupons_code ON coupons(tenant_id, code) WHERE valid = TRUE;

-- ============================================
-- 10. CUSTOMER DISCOUNTS
-- ============================================

CREATE TABLE IF NOT EXISTS customer_discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID REFERENCES coupons(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,

  -- Track usage
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ, -- When discount expires

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- At least one of customer, subscription, or invoice must be set
  CONSTRAINT customer_discount_scope CHECK (
    customer_id IS NOT NULL OR subscription_id IS NOT NULL OR invoice_id IS NOT NULL
  )
);

CREATE INDEX idx_customer_discounts_customer ON customer_discounts(customer_id);
CREATE INDEX idx_customer_discounts_subscription ON customer_discounts(subscription_id);

-- ============================================
-- 11. PORTAL SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS portal_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,

  -- Access token
  access_token TEXT NOT NULL UNIQUE,

  -- Configuration
  flow_type TEXT NOT NULL CHECK (flow_type IN (
    'portal',           -- Full customer portal
    'payment_method',   -- Update payment method only
    'subscription',     -- Manage specific subscription
    'invoice'           -- Pay specific invoice
  )),

  -- Optional scope
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,

  -- URLs
  return_url TEXT NOT NULL,

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portal_sessions_token ON portal_sessions(access_token);
CREATE INDEX idx_portal_sessions_customer ON portal_sessions(customer_id);

-- ============================================
-- 12. CHECKOUT SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,

  -- Session type
  mode TEXT NOT NULL CHECK (mode IN ('payment', 'subscription', 'setup')),

  -- Customer (optional, can be created during checkout)
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_email TEXT,

  -- Line items
  line_items JSONB NOT NULL, -- [{price_id, quantity}, {name, amount, quantity}]

  -- Payment configuration
  payment_method_types TEXT[] DEFAULT ARRAY['card'],

  -- For subscription mode
  subscription_data JSONB, -- {trial_period_days, metadata}

  -- Discounts
  discounts JSONB DEFAULT '[]', -- [{coupon: coupon_id}]

  -- URLs
  success_url TEXT NOT NULL,
  cancel_url TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete', 'expired')),

  -- Result
  payment_session_id UUID REFERENCES payment_sessions(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  customer_details JSONB, -- Collected during checkout

  -- Access
  access_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Billing address collection
  billing_address_collection TEXT DEFAULT 'auto'
    CHECK (billing_address_collection IN ('auto', 'required')),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checkout_sessions_token ON checkout_sessions(access_token)
  WHERE status = 'open';
CREATE INDEX idx_checkout_sessions_tenant ON checkout_sessions(tenant_id);

-- ============================================
-- 13. BILLING JOBS
-- ============================================

CREATE TABLE IF NOT EXISTS billing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

  job_type TEXT NOT NULL CHECK (job_type IN (
    'generate_invoice',
    'finalize_invoice',
    'charge_invoice',
    'retry_payment',
    'end_trial',
    'cancel_subscription',
    'pause_subscription',
    'send_reminder'
  )),

  scheduled_for TIMESTAMPTZ NOT NULL,

  -- Retry tracking
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 4,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'canceled')),
  completed_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_jobs_scheduled ON billing_jobs(scheduled_for)
  WHERE status = 'pending';
CREATE INDEX idx_billing_jobs_retry ON billing_jobs(next_retry_at)
  WHERE status = 'failed' AND attempts < max_attempts;
CREATE INDEX idx_billing_jobs_subscription ON billing_jobs(subscription_id);

-- ============================================
-- 14. BILLING RETRY SCHEDULES
-- ============================================

CREATE TABLE IF NOT EXISTS billing_retry_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,

  name TEXT NOT NULL DEFAULT 'Default',
  is_default BOOLEAN DEFAULT FALSE,

  -- Retry schedule: array of hours after initial failure
  retry_delays_hours INT[] DEFAULT ARRAY[24, 72, 168, 336], -- 1d, 3d, 7d, 14d

  -- Actions after all retries fail
  final_action TEXT DEFAULT 'cancel' CHECK (final_action IN ('cancel', 'unpaid', 'pause')),

  -- Dunning configuration
  send_reminder_emails BOOLEAN DEFAULT TRUE,
  reminder_schedule_hours INT[] DEFAULT ARRAY[0, 72, 168], -- On failure, 3d, 7d

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_retry_schedules_tenant ON billing_retry_schedules(tenant_id);

-- ============================================
-- 15. INVOICE NUMBER SEQUENCE
-- ============================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(tenant_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  seq_num BIGINT;
BEGIN
  -- Get a unique sequence number
  seq_num := nextval('invoice_number_seq');

  -- Format: INV-{tenant_prefix}-{padded_number}
  prefix := UPPER(SUBSTRING(tenant_uuid::TEXT FROM 1 FOR 8));
  RETURN 'INV-' || prefix || '-' || LPAD(seq_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invoice number on finalization
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open' AND OLD.status = 'draft' AND NEW.number IS NULL THEN
    NEW.number := generate_invoice_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invoice_number
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- ============================================
-- 16. UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_prices_updated_at
  BEFORE UPDATE ON prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscription_items_updated_at
  BEFORE UPDATE ON subscription_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_checkout_sessions_updated_at
  BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_billing_retry_schedules_updated_at
  BEFORE UPDATE ON billing_retry_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 17. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_retry_schedules ENABLE ROW LEVEL SECURITY;

-- Customers policies
CREATE POLICY "Users can view their tenant customers"
  ON customers FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage customers"
  ON customers FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Products policies
CREATE POLICY "Users can view their tenant products"
  ON products FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Prices policies
CREATE POLICY "Users can view their tenant prices"
  ON prices FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage prices"
  ON prices FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Subscriptions policies
CREATE POLICY "Users can view their tenant subscriptions"
  ON subscriptions FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage subscriptions"
  ON subscriptions FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Subscription items policies (via subscription)
CREATE POLICY "Users can view subscription items"
  ON subscription_items FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

CREATE POLICY "Admins can manage subscription items"
  ON subscription_items FOR ALL
  USING (
    subscription_id IN (
      SELECT s.id FROM subscriptions s
      JOIN memberships m ON s.tenant_id = m.tenant_id
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Usage records policies (via subscription item)
CREATE POLICY "Users can view usage records"
  ON usage_records FOR SELECT
  USING (
    subscription_item_id IN (
      SELECT si.id FROM subscription_items si
      JOIN subscriptions s ON si.subscription_id = s.id
      WHERE s.tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

CREATE POLICY "Admins can manage usage records"
  ON usage_records FOR ALL
  USING (
    subscription_item_id IN (
      SELECT si.id FROM subscription_items si
      JOIN subscriptions s ON si.subscription_id = s.id
      JOIN memberships m ON s.tenant_id = m.tenant_id
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Invoices policies
CREATE POLICY "Users can view their tenant invoices"
  ON invoices FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage invoices"
  ON invoices FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Invoice line items policies (via invoice)
CREATE POLICY "Users can view invoice line items"
  ON invoice_line_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

CREATE POLICY "Admins can manage invoice line items"
  ON invoice_line_items FOR ALL
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN memberships m ON i.tenant_id = m.tenant_id
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Coupons policies
CREATE POLICY "Users can view their tenant coupons"
  ON coupons FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage coupons"
  ON coupons FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Customer discounts policies
CREATE POLICY "Users can view customer discounts"
  ON customer_discounts FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
    OR subscription_id IN (
      SELECT id FROM subscriptions WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

CREATE POLICY "Admins can manage customer discounts"
  ON customer_discounts FOR ALL
  USING (
    customer_id IN (
      SELECT c.id FROM customers c
      JOIN memberships m ON c.tenant_id = m.tenant_id
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Portal sessions policies
CREATE POLICY "Users can view their tenant portal sessions"
  ON portal_sessions FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage portal sessions"
  ON portal_sessions FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Checkout sessions policies
CREATE POLICY "Users can view their tenant checkout sessions"
  ON checkout_sessions FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage checkout sessions"
  ON checkout_sessions FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Billing jobs policies
CREATE POLICY "Users can view their tenant billing jobs"
  ON billing_jobs FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage billing jobs"
  ON billing_jobs FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- Billing retry schedules policies
CREATE POLICY "Users can view their tenant retry schedules"
  ON billing_retry_schedules FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE POLICY "Admins can manage retry schedules"
  ON billing_retry_schedules FOR ALL
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE u.auth_id = auth.uid()::TEXT
        AND m.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- 18. COMMENTS
-- ============================================

COMMENT ON TABLE customers IS 'Customer records for billing and subscriptions';
COMMENT ON TABLE products IS 'Products that can be sold (subscription tiers, add-ons)';
COMMENT ON TABLE prices IS 'Pricing configurations for products (one-time, recurring, tiered)';
COMMENT ON TABLE subscriptions IS 'Active and historical subscription records';
COMMENT ON TABLE subscription_items IS 'Line items within a subscription';
COMMENT ON TABLE usage_records IS 'Metered usage for usage-based billing';
COMMENT ON TABLE invoices IS 'Billing records for subscriptions and one-time purchases';
COMMENT ON TABLE invoice_line_items IS 'Individual charges on an invoice';
COMMENT ON TABLE coupons IS 'Discount templates (percent or fixed amount)';
COMMENT ON TABLE customer_discounts IS 'Applied coupons to customers or subscriptions';
COMMENT ON TABLE portal_sessions IS 'Secure access tokens for customer portal';
COMMENT ON TABLE checkout_sessions IS 'Hosted checkout page sessions';
COMMENT ON TABLE billing_jobs IS 'Scheduled billing tasks (invoice generation, charging, retries)';
COMMENT ON TABLE billing_retry_schedules IS 'Configurable retry schedules for failed payments';

COMMENT ON COLUMN subscriptions.status IS 'Subscription lifecycle: incomplete -> trialing -> active -> past_due -> canceled/unpaid/paused';
COMMENT ON COLUMN prices.recurring_aggregate_usage IS 'For metered billing: sum, max, last_during_period, last_ever';
COMMENT ON COLUMN invoices.billing_reason IS 'What triggered this invoice: subscription_create, subscription_cycle, etc.';
