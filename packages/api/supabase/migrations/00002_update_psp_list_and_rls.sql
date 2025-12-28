-- ============================================
-- Update PSP list and add RLS policies
-- ============================================

-- Update PSP constraint for psp_credentials
alter table psp_credentials drop constraint psp_credentials_psp_check;
alter table psp_credentials add constraint psp_credentials_psp_check
  check (psp in ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex'));

-- Update PSP constraint for routing_rules
alter table routing_rules drop constraint routing_rules_psp_check;
alter table routing_rules add constraint routing_rules_psp_check
  check (psp in ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex'));

-- Update PSP constraint for payment_attempts
alter table payment_attempts drop constraint payment_attempts_psp_check;
alter table payment_attempts add constraint payment_attempts_psp_check
  check (psp in ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex'));

-- ============================================
-- RLS Policies for Dashboard Access
-- ============================================

-- Helper function to get user's tenant IDs
create or replace function get_user_tenant_ids()
returns setof uuid as $$
  select tenant_id from memberships
  where user_id = (
    select id from users where auth_id = auth.uid()::text
  )
$$ language sql security definer stable;

-- Users can see their own profile
create policy "Users can view own profile" on users
  for select using (auth_id = auth.uid()::text);

create policy "Users can update own profile" on users
  for update using (auth_id = auth.uid()::text);

-- Users can see tenants they're members of
create policy "Users can view their tenants" on tenants
  for select using (id in (select get_user_tenant_ids()));

-- Users can see their memberships
create policy "Users can view own memberships" on memberships
  for select using (user_id = (select id from users where auth_id = auth.uid()::text));

-- Tenant-scoped policies
create policy "Users can view tenant API keys" on api_keys
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage API keys" on api_keys
  for all using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
      and role in ('owner', 'admin')
    )
  );

create policy "Users can view tenant PSP credentials" on psp_credentials
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage PSP credentials" on psp_credentials
  for all using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
      and role in ('owner', 'admin')
    )
  );

create policy "Users can view routing rules" on routing_rules
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage routing rules" on routing_rules
  for all using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
      and role in ('owner', 'admin')
    )
  );

create policy "Users can view payment sessions" on payment_sessions
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Users can view tokens" on tokens
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Users can view payment attempts" on payment_attempts
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Users can view webhook events" on webhook_events
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Users can view merchant webhooks" on merchant_webhooks
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage merchant webhooks" on merchant_webhooks
  for all using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
      and role in ('owner', 'admin')
    )
  );

create policy "Users can view webhook deliveries" on webhook_deliveries
  for select using (
    webhook_id in (
      select id from merchant_webhooks
      where tenant_id in (select get_user_tenant_ids())
    )
  );

-- ============================================
-- Helper function to create user on signup
-- ============================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (auth_id, email, name)
  values (new.id::text, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
