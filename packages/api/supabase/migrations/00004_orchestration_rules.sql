-- ============================================
-- Orchestration Rules & Traffic Splitting
-- Dynamic routing, failover, and retry logic
-- ============================================

-- Drop existing routing_rules if exists (we're replacing it)
drop table if exists routing_rules cascade;

-- Vault provider type (create if not exists)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'vault_provider') then
    create type vault_provider as enum ('basis_theory', 'vgs');
  end if;
end $$;

-- ============================================
-- Orchestration Profiles
-- A profile groups routing rules together
-- ============================================

create table orchestration_profiles (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  name text not null,
  description text,
  environment text not null check (environment in ('test', 'live')),
  is_active boolean default true,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, name, environment)
);

-- ============================================
-- Traffic Split Rules (Weighted Routing)
-- Distribute traffic across PSPs by percentage
-- ============================================

create table traffic_split_rules (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references orchestration_profiles(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,

  -- Target PSP and weight
  psp text not null check (psp in (
    'stripe', 'adyen', 'authorizenet', 'chase', 'nuvei',
    'dlocal', 'braintree', 'checkoutcom', 'airwallex'
  )),
  weight int not null default 100 check (weight >= 0 and weight <= 100),

  -- Optional conditions (when null, applies to all)
  conditions jsonb default null,
  -- Example conditions:
  -- {"currency": "USD", "amount_gte": 1000, "amount_lte": 50000}
  -- {"card_brand": "visa", "country": "US"}
  -- {"payment_method": "card"}

  -- Priority for condition matching (higher = checked first)
  priority int not null default 0,

  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- Retry & Failover Rules
-- Configure automatic retries on PSP failure
-- ============================================

create table retry_rules (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references orchestration_profiles(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,

  -- Source PSP that failed
  source_psp text not null check (source_psp in (
    'stripe', 'adyen', 'authorizenet', 'chase', 'nuvei',
    'dlocal', 'braintree', 'checkoutcom', 'airwallex'
  )),

  -- Target PSP to retry with
  target_psp text not null check (target_psp in (
    'stripe', 'adyen', 'authorizenet', 'chase', 'nuvei',
    'dlocal', 'braintree', 'checkoutcom', 'airwallex'
  )),

  -- Retry order (1 = first retry, 2 = second retry, etc.)
  retry_order int not null default 1 check (retry_order >= 1 and retry_order <= 5),

  -- Failure conditions that trigger retry
  -- null = any failure, or specific codes
  failure_codes text[] default null,
  -- Example: ['card_declined', 'insufficient_funds', 'processor_error']

  -- Retry configuration
  max_retries int default 1 check (max_retries >= 1 and max_retries <= 5),
  retry_delay_ms int default 0 check (retry_delay_ms >= 0 and retry_delay_ms <= 5000),

  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Prevent duplicate retry rules for same source->target in same profile
  unique (profile_id, source_psp, target_psp, retry_order)
);

-- ============================================
-- PSP Priority Rules (Fallback Order)
-- Define PSP priority when weights are equal or for failover
-- ============================================

create table psp_priorities (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references orchestration_profiles(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,

  psp text not null check (psp in (
    'stripe', 'adyen', 'authorizenet', 'chase', 'nuvei',
    'dlocal', 'braintree', 'checkoutcom', 'airwallex'
  )),

  -- Priority order (1 = highest priority)
  priority int not null default 1 check (priority >= 1 and priority <= 20),

  -- Health check - mark PSP as degraded/down
  is_healthy boolean default true,
  health_check_url text,
  last_health_check timestamptz,

  -- Performance metrics (updated by system)
  avg_latency_ms int,
  success_rate decimal(5,2),
  last_success_at timestamptz,
  last_failure_at timestamptz,

  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (profile_id, psp)
);

-- ============================================
-- Vault Configuration
-- Configure vault provider per tenant (Basis Theory or VGS)
-- ============================================

create table vault_configs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  environment text not null check (environment in ('test', 'live')),

  -- Primary vault
  primary_vault text not null default 'basis_theory' check (primary_vault in ('basis_theory', 'vgs')),

  -- Basis Theory config
  bt_public_key text,
  bt_private_key_encrypted text,

  -- VGS config
  vgs_vault_id text,
  vgs_environment text check (vgs_environment in ('sandbox', 'live')),
  vgs_access_credentials_encrypted text, -- JSON with username/password

  -- Failover vault (optional)
  failover_vault text check (failover_vault in ('basis_theory', 'vgs')),

  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (tenant_id, environment)
);

-- ============================================
-- Routing Decision Log (for analytics)
-- Log every routing decision for optimization
-- ============================================

create table routing_decisions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  session_id uuid references payment_sessions(id) on delete cascade,
  attempt_id uuid references payment_attempts(id) on delete cascade,
  profile_id uuid references orchestration_profiles(id) on delete set null,

  -- Decision details
  selected_psp text not null,
  selection_reason text not null, -- 'weighted_random', 'retry', 'failover', 'condition_match'

  -- Context at decision time
  amount int,
  currency text,
  payment_method text,
  card_brand text,

  -- Candidate PSPs considered
  candidates jsonb, -- [{psp: 'stripe', weight: 25}, ...]

  -- If retry
  is_retry boolean default false,
  retry_number int,
  previous_psp text,
  previous_failure_code text,

  -- Outcome
  outcome text check (outcome in ('pending', 'success', 'failure')),
  outcome_at timestamptz,

  created_at timestamptz default now()
);

-- ============================================
-- Indexes
-- ============================================

create index idx_orchestration_profiles_tenant on orchestration_profiles(tenant_id, environment);
create index idx_traffic_split_rules_profile on traffic_split_rules(profile_id, is_active);
create index idx_retry_rules_profile on retry_rules(profile_id, source_psp);
create index idx_psp_priorities_profile on psp_priorities(profile_id);
create index idx_vault_configs_tenant on vault_configs(tenant_id, environment);
create index idx_routing_decisions_tenant on routing_decisions(tenant_id, created_at desc);
create index idx_routing_decisions_session on routing_decisions(session_id);

-- ============================================
-- Row Level Security
-- ============================================

alter table orchestration_profiles enable row level security;
alter table traffic_split_rules enable row level security;
alter table retry_rules enable row level security;
alter table psp_priorities enable row level security;
alter table vault_configs enable row level security;
alter table routing_decisions enable row level security;

-- Policies for orchestration_profiles
create policy "Users can view their tenant orchestration profiles"
  on orchestration_profiles for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage orchestration profiles"
  on orchestration_profiles for all
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- Policies for traffic_split_rules
create policy "Users can view their tenant traffic rules"
  on traffic_split_rules for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage traffic rules"
  on traffic_split_rules for all
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- Policies for retry_rules
create policy "Users can view their tenant retry rules"
  on retry_rules for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage retry rules"
  on retry_rules for all
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- Policies for psp_priorities
create policy "Users can view their tenant PSP priorities"
  on psp_priorities for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage PSP priorities"
  on psp_priorities for all
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- Policies for vault_configs
create policy "Users can view their tenant vault configs"
  on vault_configs for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage vault configs"
  on vault_configs for all
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- Policies for routing_decisions (read-only for users)
create policy "Users can view their tenant routing decisions"
  on routing_decisions for select
  using (tenant_id in (select get_user_tenant_ids()));

-- ============================================
-- Updated At Triggers
-- ============================================

create trigger orchestration_profiles_updated_at before update on orchestration_profiles
  for each row execute function update_updated_at();

create trigger traffic_split_rules_updated_at before update on traffic_split_rules
  for each row execute function update_updated_at();

create trigger retry_rules_updated_at before update on retry_rules
  for each row execute function update_updated_at();

create trigger psp_priorities_updated_at before update on psp_priorities
  for each row execute function update_updated_at();

create trigger vault_configs_updated_at before update on vault_configs
  for each row execute function update_updated_at();

-- ============================================
-- Helper function: Get active profile for tenant
-- ============================================

create or replace function get_active_orchestration_profile(
  p_tenant_id uuid,
  p_environment text
) returns uuid as $$
  select id from orchestration_profiles
  where tenant_id = p_tenant_id
    and environment = p_environment
    and is_active = true
    and is_default = true
  limit 1;
$$ language sql stable;

-- ============================================
-- Helper function: Select PSP based on weighted routing
-- Returns the selected PSP name
-- ============================================

create or replace function select_weighted_psp(
  p_profile_id uuid,
  p_amount int default null,
  p_currency text default null,
  p_payment_method text default null,
  p_card_brand text default null
) returns text as $$
declare
  v_total_weight int;
  v_random int;
  v_cumulative int := 0;
  v_rule record;
begin
  -- Get total weight of matching active rules
  select coalesce(sum(weight), 0) into v_total_weight
  from traffic_split_rules
  where profile_id = p_profile_id
    and is_active = true
    and (conditions is null or (
      (conditions->>'currency' is null or conditions->>'currency' = p_currency) and
      (conditions->>'payment_method' is null or conditions->>'payment_method' = p_payment_method) and
      (conditions->>'card_brand' is null or conditions->>'card_brand' = p_card_brand) and
      (conditions->>'amount_gte' is null or p_amount >= (conditions->>'amount_gte')::int) and
      (conditions->>'amount_lte' is null or p_amount <= (conditions->>'amount_lte')::int)
    ));

  if v_total_weight = 0 then
    return null;
  end if;

  -- Generate random number between 1 and total weight
  v_random := floor(random() * v_total_weight) + 1;

  -- Select PSP based on weighted random
  for v_rule in
    select psp, weight from traffic_split_rules
    where profile_id = p_profile_id
      and is_active = true
      and (conditions is null or (
        (conditions->>'currency' is null or conditions->>'currency' = p_currency) and
        (conditions->>'payment_method' is null or conditions->>'payment_method' = p_payment_method) and
        (conditions->>'card_brand' is null or conditions->>'card_brand' = p_card_brand) and
        (conditions->>'amount_gte' is null or p_amount >= (conditions->>'amount_gte')::int) and
        (conditions->>'amount_lte' is null or p_amount <= (conditions->>'amount_lte')::int)
      ))
    order by priority desc, weight desc
  loop
    v_cumulative := v_cumulative + v_rule.weight;
    if v_random <= v_cumulative then
      return v_rule.psp;
    end if;
  end loop;

  return null;
end;
$$ language plpgsql stable;
