-- ============================================
-- Fix Orchestration RLS Policies for INSERT
-- The original policies used "for all" with "using()"
-- but INSERT requires "with check()" clause
-- ============================================

-- Drop existing policies
drop policy if exists "Admins can manage orchestration profiles" on orchestration_profiles;
drop policy if exists "Admins can manage traffic rules" on traffic_split_rules;
drop policy if exists "Admins can manage retry rules" on retry_rules;
drop policy if exists "Admins can manage PSP priorities" on psp_priorities;
drop policy if exists "Admins can manage vault configs" on vault_configs;

-- Recreate with proper INSERT support
-- orchestration_profiles
create policy "Members can insert orchestration profiles"
  on orchestration_profiles for insert
  with check (
    tenant_id in (select get_user_tenant_ids())
  );

create policy "Admins can update orchestration profiles"
  on orchestration_profiles for update
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

create policy "Admins can delete orchestration profiles"
  on orchestration_profiles for delete
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- traffic_split_rules
create policy "Members can insert traffic rules"
  on traffic_split_rules for insert
  with check (
    tenant_id in (select get_user_tenant_ids())
  );

create policy "Admins can update traffic rules"
  on traffic_split_rules for update
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

create policy "Admins can delete traffic rules"
  on traffic_split_rules for delete
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- retry_rules
create policy "Members can insert retry rules"
  on retry_rules for insert
  with check (
    tenant_id in (select get_user_tenant_ids())
  );

create policy "Admins can update retry rules"
  on retry_rules for update
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

create policy "Admins can delete retry rules"
  on retry_rules for delete
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- psp_priorities
create policy "Members can insert PSP priorities"
  on psp_priorities for insert
  with check (
    tenant_id in (select get_user_tenant_ids())
  );

create policy "Admins can update PSP priorities"
  on psp_priorities for update
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

create policy "Admins can delete PSP priorities"
  on psp_priorities for delete
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

-- vault_configs
create policy "Members can insert vault configs"
  on vault_configs for insert
  with check (
    tenant_id in (select get_user_tenant_ids())
  );

create policy "Admins can update vault configs"
  on vault_configs for update
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );

create policy "Admins can delete vault configs"
  on vault_configs for delete
  using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
    )
  );
