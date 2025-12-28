-- ============================================
-- Payment Methods Configuration
-- Apple Pay, Google Pay, Bank Accounts (ACH)
-- ============================================

-- Add payment method types enum
create type payment_method_type as enum ('card', 'apple_pay', 'google_pay', 'bank_account');

-- Add payment method column to payment_attempts
alter table payment_attempts add column if not exists payment_method_type payment_method_type default 'card';

-- Add wallet details to payment_attempts
alter table payment_attempts add column if not exists wallet_type text;
alter table payment_attempts add column if not exists wallet_network text;

-- Add bank account details to payment_attempts
alter table payment_attempts add column if not exists bank_name text;
alter table payment_attempts add column if not exists bank_last4 text;
alter table payment_attempts add column if not exists bank_account_type text;

-- Payment method configuration per tenant
create table payment_method_configs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  environment text not null check (environment in ('test', 'live')),

  -- Card configuration
  card_enabled boolean default true,
  card_brands text[] default array['visa', 'mastercard', 'amex', 'discover'],

  -- Apple Pay configuration
  apple_pay_enabled boolean default false,
  apple_pay_merchant_id text,
  apple_pay_merchant_name text,
  apple_pay_merchant_cert_encrypted text, -- encrypted PEM
  apple_pay_merchant_key_encrypted text, -- encrypted private key
  apple_pay_supported_networks text[] default array['visa', 'mastercard', 'amex'],

  -- Google Pay configuration
  google_pay_enabled boolean default false,
  google_pay_merchant_id text,
  google_pay_merchant_name text,
  google_pay_environment text default 'TEST' check (google_pay_environment in ('TEST', 'PRODUCTION')),
  google_pay_allowed_networks text[] default array['VISA', 'MASTERCARD', 'AMEX'],

  -- Bank Account (ACH) configuration
  bank_account_enabled boolean default false,
  bank_account_types text[] default array['checking', 'savings'],

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, environment)
);

-- Add payment method types to payment sessions
alter table payment_sessions add column if not exists payment_method_types payment_method_type[] default array['card']::payment_method_type[];

-- Index for payment method config
create index idx_payment_method_configs_tenant on payment_method_configs(tenant_id);

-- RLS for payment method configs
alter table payment_method_configs enable row level security;

-- Policy: users can view their tenant's payment method configs
create policy "Users can view their tenant payment method configs"
  on payment_method_configs for select
  using (tenant_id in (select get_user_tenant_ids()));

-- Policy: admins/owners can update payment method configs
create policy "Admins can update payment method configs"
  on payment_method_configs for all
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- Trigger for updated_at
create trigger payment_method_configs_updated_at before update on payment_method_configs
  for each row execute function update_updated_at();

-- ============================================
-- Bank Account Tokens (for ACH)
-- ============================================

create table bank_account_tokens (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  customer_email text,
  vault_provider text not null default 'basis_theory',
  vault_token_id text not null, -- BT token ID for bank account
  bank_name text,
  account_last4 text,
  account_type text check (account_type in ('checking', 'savings')),
  routing_number_last4 text,
  is_verified boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index idx_bank_account_tokens_tenant on bank_account_tokens(tenant_id);
create index idx_bank_account_tokens_customer on bank_account_tokens(tenant_id, customer_email);

alter table bank_account_tokens enable row level security;

create policy "Users can view their tenant bank account tokens"
  on bank_account_tokens for select
  using (tenant_id in (select get_user_tenant_ids()));

-- ============================================
-- Apple Pay Domains (for domain verification)
-- ============================================

create table apple_pay_domains (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  domain text not null,
  verified boolean default false,
  verification_file_content text, -- apple-developer-merchantid-domain-association
  verified_at timestamptz,
  created_at timestamptz default now(),
  unique (tenant_id, domain)
);

create index idx_apple_pay_domains_tenant on apple_pay_domains(tenant_id);

alter table apple_pay_domains enable row level security;

create policy "Users can view their tenant Apple Pay domains"
  on apple_pay_domains for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage Apple Pay domains"
  on apple_pay_domains for all
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );
