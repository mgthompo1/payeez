-- ============================================
-- Payeez Database Schema
-- Processor-agnostic payment orchestration
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- Core Multi-Tenancy
-- ============================================

create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  environment text not null default 'test' check (environment in ('test', 'live')),
  basis_theory_public_key text, -- BT public key for Elements
  basis_theory_private_key_encrypted text, -- BT private key (encrypted)
  webhook_secret text, -- for signing outbound webhooks
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  auth_id text unique not null, -- Supabase auth.users.id
  name text,
  created_at timestamptz default now()
);

create table memberships (
  user_id uuid references users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  primary key (user_id, tenant_id)
);

-- ============================================
-- API Keys (for merchant authentication)
-- ============================================

create table api_keys (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  key_prefix text not null, -- "sk_test_" or "sk_live_"
  key_hash text not null, -- bcrypt hash of the full key
  label text,
  environment text not null check (environment in ('test', 'live')),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================
-- PSP Credentials (encrypted)
-- ============================================

create table psp_credentials (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  psp text not null check (psp in ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex')),
  environment text not null check (environment in ('test', 'live')),
  credentials_encrypted text not null, -- JSON blob encrypted with KMS
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, psp, environment)
);

-- ============================================
-- Routing Rules
-- ============================================

create table routing_rules (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  priority int not null default 0, -- higher = checked first
  conditions jsonb not null default '{}', -- {currency: "NZD", amount_gte: 10000}
  psp text not null check (psp in ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex')),
  weight int default 100 check (weight >= 0 and weight <= 100), -- for load balancing
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- Payment Sessions (checkout container)
-- ============================================

create table payment_sessions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  external_id text, -- merchant's order_id
  client_secret text not null, -- for frontend authentication
  amount int not null check (amount > 0), -- cents
  currency text not null,
  status text not null default 'pending'
    check (status in ('pending', 'requires_payment_method', 'processing', 'succeeded', 'failed', 'canceled')),
  capture_method text default 'automatic' check (capture_method in ('automatic', 'manual')),
  customer_email text,
  customer_name text,
  metadata jsonb default '{}',
  success_url text,
  cancel_url text,
  fallback_url text, -- PSP hosted checkout for break-glass
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- Tokens (canonical token -> vault references)
-- ============================================

create table tokens (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  customer_email text,
  vault_provider text not null default 'basis_theory' check (vault_provider in ('basis_theory')),
  vault_token_id text not null, -- the actual token ID from Basis Theory
  card_brand text,
  card_last4 text,
  card_exp_month int,
  card_exp_year int,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================
-- Payment Attempts (ledger of every PSP call)
-- ============================================

create table payment_attempts (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references payment_sessions(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,
  token_id uuid references tokens(id),
  psp text not null check (psp in ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex')),
  psp_transaction_id text, -- PSP's transaction/payment ID
  idempotency_key text not null,
  amount int not null,
  currency text not null,
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'captured', 'failed', 'canceled')),
  failure_code text,
  failure_message text,
  failure_category text, -- normalized: card_declined, insufficient_funds, etc.
  raw_response jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (idempotency_key)
);

-- ============================================
-- Webhook Events (normalized)
-- ============================================

create table webhook_events (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  session_id uuid references payment_sessions(id),
  attempt_id uuid references payment_attempts(id),
  event_type text not null, -- 'payment.authorized', 'payment.captured', etc.
  psp text not null,
  psp_event_id text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================
-- Outbound Webhooks (to merchants)
-- ============================================

create table merchant_webhooks (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  url text not null,
  events text[] not null default array['payment.captured', 'payment.failed', 'refund.succeeded'],
  is_active boolean default true,
  created_at timestamptz default now()
);

create table webhook_deliveries (
  id uuid primary key default uuid_generate_v4(),
  webhook_id uuid references merchant_webhooks(id) on delete cascade not null,
  event_type text not null,
  payload jsonb not null,
  response_status int,
  response_body text,
  delivered_at timestamptz,
  attempts int default 0,
  next_retry_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================
-- Indexes
-- ============================================

create index idx_api_keys_tenant on api_keys(tenant_id) where revoked_at is null;
create index idx_api_keys_prefix on api_keys(key_prefix);
create index idx_sessions_tenant on payment_sessions(tenant_id);
create index idx_sessions_external on payment_sessions(tenant_id, external_id);
create index idx_sessions_status on payment_sessions(status) where status not in ('succeeded', 'failed', 'canceled');
create index idx_attempts_session on payment_attempts(session_id);
create index idx_attempts_psp_tx on payment_attempts(psp_transaction_id);
create index idx_tokens_tenant on tokens(tenant_id);
create index idx_routing_tenant on routing_rules(tenant_id, is_active) where is_active = true;
create index idx_webhook_events_session on webhook_events(session_id);
create index idx_webhook_deliveries_retry on webhook_deliveries(next_retry_at) where delivered_at is null;

-- ============================================
-- Row Level Security (basic)
-- ============================================

alter table tenants enable row level security;
alter table users enable row level security;
alter table memberships enable row level security;
alter table api_keys enable row level security;
alter table psp_credentials enable row level security;
alter table routing_rules enable row level security;
alter table payment_sessions enable row level security;
alter table tokens enable row level security;
alter table payment_attempts enable row level security;
alter table webhook_events enable row level security;
alter table merchant_webhooks enable row level security;
alter table webhook_deliveries enable row level security;

-- ============================================
-- Updated At Trigger
-- ============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tenants_updated_at before update on tenants
  for each row execute function update_updated_at();

create trigger psp_credentials_updated_at before update on psp_credentials
  for each row execute function update_updated_at();

create trigger routing_rules_updated_at before update on routing_rules
  for each row execute function update_updated_at();

create trigger payment_sessions_updated_at before update on payment_sessions
  for each row execute function update_updated_at();

create trigger payment_attempts_updated_at before update on payment_attempts
  for each row execute function update_updated_at();
