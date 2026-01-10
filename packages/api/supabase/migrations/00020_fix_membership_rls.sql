-- ============================================
-- Fix infinite recursion in memberships RLS
-- The policies were querying memberships to check memberships
-- ============================================

-- Drop existing problematic policies
drop policy if exists "Users can view own memberships" on memberships;
drop policy if exists "Members can view tenant memberships" on memberships;
drop policy if exists "Admins can manage memberships" on memberships;

-- Create a helper function that bypasses RLS to check user membership
-- This prevents infinite recursion
create or replace function get_user_tenant_ids()
returns setof uuid as $$
  select m.tenant_id
  from memberships m
  join users u on u.id = m.user_id
  where u.auth_id = auth.uid()::text
$$ language sql security definer stable;

-- Now create policies using the helper function
create policy "Users can view memberships for their tenants" on memberships
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Users can insert memberships for their tenants" on memberships
  for insert with check (tenant_id in (select get_user_tenant_ids()));

create policy "Users can update memberships for their tenants" on memberships
  for update using (tenant_id in (select get_user_tenant_ids()));

create policy "Users can delete memberships for their tenants" on memberships
  for delete using (tenant_id in (select get_user_tenant_ids()));

-- Also fix any other policies that might have the same issue
-- Update psp_credentials policy if it has the same pattern
drop policy if exists "Users can view own tenant's PSP credentials" on psp_credentials;
drop policy if exists "Users can manage own tenant's PSP credentials" on psp_credentials;

create policy "Users can view own tenant PSP credentials" on psp_credentials
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Users can insert own tenant PSP credentials" on psp_credentials
  for insert with check (tenant_id in (select get_user_tenant_ids()));

create policy "Users can update own tenant PSP credentials" on psp_credentials
  for update using (tenant_id in (select get_user_tenant_ids()));

create policy "Users can delete own tenant PSP credentials" on psp_credentials
  for delete using (tenant_id in (select get_user_tenant_ids()));
