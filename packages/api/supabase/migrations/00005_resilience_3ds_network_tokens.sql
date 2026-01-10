-- Migration: Resilience, 3DS, and Network Tokens
-- This migration adds support for:
-- 1. Multi-region resilience and health monitoring
-- 2. 3D Secure authentication
-- 3. Network Token enrichment
-- 4. API card collection via proxy

-- ============================================
-- RESILIENCE & HEALTH MONITORING
-- ============================================

-- Service health status enum
create type service_status as enum ('healthy', 'degraded', 'down');

-- Track health of our own endpoints and dependencies
create table if not exists service_health (
  id uuid primary key default gen_random_uuid(),
  service_name text not null, -- 'atlas_primary', 'atlas_eu', 'basis_theory', 'vgs', 'stripe', etc.
  region text not null default 'us', -- 'us', 'eu', 'ap'
  status service_status not null default 'healthy',
  latency_ms integer,
  last_check_at timestamptz not null default now(),
  consecutive_failures integer not null default 0,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_name, region)
);

-- Resilience configuration per tenant
create table if not exists tenant_resilience_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  -- Failover chain (ordered list of endpoints to try)
  failover_chain jsonb not null default '[
    {"name": "primary", "type": "atlas", "region": "us"},
    {"name": "backup", "type": "atlas", "region": "eu"},
    {"name": "reactor", "type": "basis_theory_reactor"},
    {"name": "emergency", "type": "direct_psp"}
  ]',

  -- Circuit breaker settings
  circuit_breaker_threshold integer not null default 3,
  circuit_breaker_recovery_ms integer not null default 30000,

  -- Emergency PSP (used when all else fails)
  emergency_psp text, -- 'stripe', 'adyen', etc.

  -- Multi-vault configuration
  primary_vault text not null default 'basis_theory',
  fallback_vault text default 'vgs',
  dual_vault_enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id)
);

-- Track transactions processed via fallback routes
create table if not exists fallback_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  payment_session_id uuid references payment_sessions(id),

  -- Which fallback route was used
  fallback_route text not null, -- 'backup_region', 'bt_reactor', 'direct_psp'
  original_route text not null default 'primary',

  -- Transaction details for reconciliation
  amount integer not null,
  currency text not null,
  psp text not null,
  psp_transaction_id text,
  status text not null,

  -- Sync status
  synced_to_primary boolean not null default false,
  synced_at timestamptz,
  sync_attempts integer not null default 0,

  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================
-- 3D SECURE
-- ============================================

-- 3DS configuration per tenant per PSP
create table if not exists threeds_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  psp text not null, -- 'stripe', 'adyen', etc.

  -- Required merchant info from PSP
  merchant_name text not null,
  merchant_url text,
  merchant_category_code text not null, -- MCC (4 digits)
  merchant_country_code text not null, -- ISO 3166-1 numeric

  -- PSP-specific identifiers (can have multiple per network)
  acquirer_merchant_ids jsonb not null default '{}', -- {"visa": "mid_123", "mastercard": "mid_456"}
  acquirer_bins jsonb not null default '{}', -- {"visa": "123456", "mastercard": "654321"}

  -- American Express specific
  amex_requestor_type text default 'MER', -- MER, AGG, OTA, OPT, etc.

  -- Cartes Bancaires specific
  cb_siret_number text,

  -- Settings
  enabled boolean not null default true,
  challenge_preference text not null default 'no_preference', -- 'no_preference', 'no_challenge', 'challenge_requested', 'challenge_mandated'

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, psp)
);

-- 3DS authentication sessions
create table if not exists threeds_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  payment_session_id uuid references payment_sessions(id),

  -- Card info (references token)
  token_id text not null,
  card_brand text, -- 'visa', 'mastercard', 'amex', etc.

  -- 3DS version used
  threeds_version text not null default '2.2.0', -- '2.1.0', '2.2.0'

  -- Authentication status
  status text not null default 'pending', -- 'pending', 'challenge_required', 'authenticated', 'failed', 'attempted'

  -- Transaction details for 3DS
  amount integer not null,
  currency text not null,

  -- 3DS response data
  authentication_value text, -- CAVV/AAV
  eci text, -- Electronic Commerce Indicator
  ds_transaction_id text, -- Directory Server Transaction ID
  acs_transaction_id text, -- Access Control Server Transaction ID
  threeds_server_transaction_id text,

  -- Challenge data (if challenge required)
  challenge_required boolean not null default false,
  challenge_url text,
  challenge_completed boolean default false,

  -- Result
  authentication_status text, -- 'Y' (success), 'N' (failed), 'A' (attempted), 'U' (unavailable), 'C' (challenge), 'R' (rejected)
  authentication_status_reason text,

  -- Liability shift
  liability_shift boolean default false,

  -- Raw response for debugging
  raw_response jsonb default '{}',

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  authenticated_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index idx_threeds_sessions_tenant on threeds_sessions(tenant_id);
create index idx_threeds_sessions_payment on threeds_sessions(payment_session_id);
create index idx_threeds_sessions_status on threeds_sessions(status);

-- ============================================
-- NETWORK TOKENS
-- ============================================

-- Network token enrichment for cards
create table if not exists network_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  -- Original card token (Basis Theory token ID)
  card_token_id text not null,

  -- Network token data
  network text not null, -- 'visa', 'mastercard', 'amex'
  network_token text not null, -- The actual network token (DPAN)
  token_reference_id text, -- Network's reference ID
  token_requestor_id text, -- TRID

  -- Expiration
  token_expiry_month text not null,
  token_expiry_year text not null,

  -- Status
  status text not null default 'active', -- 'active', 'suspended', 'deleted'

  -- Last cryptogram (for CIT transactions)
  last_cryptogram text,
  last_cryptogram_type text, -- 'TAVV', 'DTVV', etc.
  last_cryptogram_generated_at timestamptz,
  cryptogram_expires_at timestamptz,

  -- Lifecycle management
  last_updated_by_network_at timestamptz,

  -- Metadata
  metadata jsonb default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(card_token_id, network)
);

create index idx_network_tokens_tenant on network_tokens(tenant_id);
create index idx_network_tokens_card on network_tokens(card_token_id);
create index idx_network_tokens_status on network_tokens(status);

-- Network token lifecycle events (for audit)
create table if not exists network_token_events (
  id uuid primary key default gen_random_uuid(),
  network_token_id uuid not null references network_tokens(id) on delete cascade,

  event_type text not null, -- 'created', 'updated', 'suspended', 'resumed', 'deleted', 'cryptogram_generated'
  event_data jsonb default '{}',

  created_at timestamptz not null default now()
);

-- ============================================
-- API CARD COLLECTION (INBOUND PROXY)
-- ============================================

-- Proxy endpoints for receiving cards via API
create table if not exists card_collection_proxies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  -- Proxy identification
  name text not null,
  proxy_key text not null unique, -- Used to invoke the proxy

  -- Destination (merchant's API)
  destination_url text not null,

  -- Request transform configuration
  request_transform_enabled boolean not null default true,
  card_field_path text not null default 'payment_method', -- JSON path to card data

  -- Supported content types
  supported_content_types text[] not null default array['application/json'],

  -- Authentication
  require_auth boolean not null default true,
  auth_type text default 'api_key', -- 'api_key', 'jwt', 'custom'
  auth_config jsonb default '{}',

  -- Rate limiting
  rate_limit_per_minute integer default 100,

  -- Status
  enabled boolean not null default true,

  -- Stats
  total_requests integer not null default 0,
  successful_requests integer not null default 0,
  failed_requests integer not null default 0,
  last_request_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_card_collection_proxies_tenant on card_collection_proxies(tenant_id);
create index idx_card_collection_proxies_key on card_collection_proxies(proxy_key);

-- Token intents created via proxy (for tracking)
create table if not exists proxy_token_intents (
  id uuid primary key default gen_random_uuid(),
  proxy_id uuid not null references card_collection_proxies(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,

  -- Token intent from Basis Theory
  token_intent_id text not null,

  -- Request info
  source_ip text,
  content_type text,

  -- Conversion status
  converted_to_token boolean not null default false,
  token_id text,
  converted_at timestamptz,

  -- Expiration
  expires_at timestamptz not null default (now() + interval '1 hour'),

  created_at timestamptz not null default now()
);

-- ============================================
-- UPDATED PAYMENT SESSIONS FOR 3DS
-- ============================================

-- Add 3DS fields to payment_sessions
alter table payment_sessions
  add column if not exists threeds_session_id uuid references threeds_sessions(id),
  add column if not exists threeds_required boolean default false,
  add column if not exists threeds_authenticated boolean default false;

-- Add network token fields to payment_attempts
alter table payment_attempts
  add column if not exists network_token_id uuid references network_tokens(id),
  add column if not exists used_network_token boolean default false,
  add column if not exists cryptogram text;

-- ============================================
-- HELPER FUNCTION
-- ============================================

-- Helper function to get current user's tenant (needed for RLS)
create or replace function get_current_tenant_id()
returns uuid as $$
declare
  current_tenant_id uuid;
begin
  select m.tenant_id into current_tenant_id
  from memberships m
  join users u on u.id = m.user_id
  where u.auth_id = auth.uid()::text
  limit 1;

  return current_tenant_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table service_health enable row level security;
alter table tenant_resilience_config enable row level security;
alter table fallback_transactions enable row level security;
alter table threeds_config enable row level security;
alter table threeds_sessions enable row level security;
alter table network_tokens enable row level security;
alter table network_token_events enable row level security;
alter table card_collection_proxies enable row level security;
alter table proxy_token_intents enable row level security;

-- Service health is readable by authenticated users
create policy "Service health readable by authenticated" on service_health
  for select using (auth.role() = 'authenticated');

-- Tenant-specific tables: tenants can only see their own data
create policy "Tenants see own resilience config" on tenant_resilience_config
  for all using (tenant_id = get_current_tenant_id());

create policy "Tenants see own fallback transactions" on fallback_transactions
  for all using (tenant_id = get_current_tenant_id());

create policy "Tenants see own 3DS config" on threeds_config
  for all using (tenant_id = get_current_tenant_id());

create policy "Tenants see own 3DS sessions" on threeds_sessions
  for all using (tenant_id = get_current_tenant_id());

create policy "Tenants see own network tokens" on network_tokens
  for all using (tenant_id = get_current_tenant_id());

create policy "Tenants see own network token events" on network_token_events
  for all using (network_token_id in (
    select id from network_tokens where tenant_id = get_current_tenant_id()
  ));

create policy "Tenants see own card collection proxies" on card_collection_proxies
  for all using (tenant_id = get_current_tenant_id());

create policy "Tenants see own proxy token intents" on proxy_token_intents
  for all using (tenant_id = get_current_tenant_id());

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get healthy services for failover
create or replace function get_healthy_services(p_service_type text default null)
returns table (
  service_name text,
  region text,
  status service_status,
  latency_ms integer
) as $$
begin
  return query
  select sh.service_name, sh.region, sh.status, sh.latency_ms
  from service_health sh
  where sh.status != 'down'
    and (p_service_type is null or sh.service_name like p_service_type || '%')
  order by
    case sh.status when 'healthy' then 0 when 'degraded' then 1 else 2 end,
    sh.latency_ms nulls last;
end;
$$ language plpgsql security definer;

-- Function to record health check
create or replace function record_health_check(
  p_service_name text,
  p_region text,
  p_status service_status,
  p_latency_ms integer default null
) returns void as $$
declare
  v_consecutive_failures integer;
begin
  -- Get current consecutive failures
  select consecutive_failures into v_consecutive_failures
  from service_health
  where service_name = p_service_name and region = p_region;

  -- Update or insert
  insert into service_health (service_name, region, status, latency_ms, consecutive_failures, last_check_at)
  values (
    p_service_name,
    p_region,
    p_status,
    p_latency_ms,
    case when p_status = 'down' then coalesce(v_consecutive_failures, 0) + 1 else 0 end,
    now()
  )
  on conflict (service_name, region) do update set
    status = excluded.status,
    latency_ms = excluded.latency_ms,
    consecutive_failures = case when excluded.status = 'down' then service_health.consecutive_failures + 1 else 0 end,
    last_check_at = now(),
    updated_at = now();
end;
$$ language plpgsql security definer;

-- Function to generate cryptogram request ID
create or replace function generate_cryptogram_request()
returns text as $$
begin
  return 'crypt_' || encode(gen_random_bytes(16), 'hex');
end;
$$ language plpgsql;
