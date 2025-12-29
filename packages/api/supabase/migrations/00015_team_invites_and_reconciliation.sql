-- ============================================
-- Team invites + reconciliation schema
-- ============================================

-- Team invites
create table team_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  token text not null unique,
  invited_by uuid references users(id) on delete set null,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

create index idx_team_invites_tenant on team_invites(tenant_id, created_at desc);
create index idx_team_invites_token on team_invites(token);

alter table team_invites enable row level security;

create policy "Members can view team invites" on team_invites
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage team invites" on team_invites
  for all using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
      and role in ('owner', 'admin')
    )
  );

-- Membership visibility + management
create policy "Members can view tenant memberships" on memberships
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage memberships" on memberships
  for all using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
      and role in ('owner', 'admin')
    )
  );

-- Accept invite function
create or replace function accept_team_invite(p_token text)
returns void as $$
declare
  v_invite record;
  v_user_id uuid;
  v_user_email text;
begin
  select id, email into v_user_id, v_user_email
  from users
  where auth_id = auth.uid()::text;

  if v_user_id is null then
    raise exception 'User not found';
  end if;

  select * into v_invite
  from team_invites
  where token = p_token
    and accepted_at is null
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Invite not found or expired';
  end if;

  if lower(v_invite.email) <> lower(v_user_email) then
    raise exception 'Invite email mismatch';
  end if;

  insert into memberships (user_id, tenant_id, role)
  values (v_user_id, v_invite.tenant_id, v_invite.role)
  on conflict do nothing;

  update team_invites
  set accepted_at = now()
  where id = v_invite.id;
end;
$$ language plpgsql security definer;

grant execute on function accept_team_invite(text) to authenticated;

-- ============================================
-- Reconciliation tables
-- ============================================

create table settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  psp text not null check (psp in ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex')),
  currency text not null,
  gross_amount int not null,
  fee_amount int not null default 0,
  net_amount int not null,
  period_start timestamptz,
  period_end timestamptz,
  deposited_at timestamptz,
  status text not null check (status in ('pending', 'paid', 'failed', 'reconciled')),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid references settlements(id) on delete cascade not null,
  payment_attempt_id uuid references payment_attempts(id) on delete set null,
  amount int not null,
  fee_amount int not null default 0,
  net_amount int not null,
  created_at timestamptz default now()
);

create index idx_settlements_tenant on settlements(tenant_id, deposited_at desc);
create index idx_settlement_items_settlement on settlement_items(settlement_id);

create trigger settlements_updated_at before update on settlements
  for each row execute function update_updated_at();

alter table settlements enable row level security;
alter table settlement_items enable row level security;

create policy "Users can view settlements" on settlements
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage settlements" on settlements
  for all using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
      and role in ('owner', 'admin')
    )
  );

create policy "Users can view settlement items" on settlement_items
  for select using (
    settlement_id in (
      select id from settlements
      where tenant_id in (select get_user_tenant_ids())
    )
  );

create policy "Admins can manage settlement items" on settlement_items
  for all using (
    settlement_id in (
      select id from settlements
      where tenant_id in (
        select tenant_id from memberships
        where user_id = (select id from users where auth_id = auth.uid()::text)
        and role in ('owner', 'admin')
      )
    )
  );

-- Refund visibility
alter table refunds enable row level security;

create policy "Users can view refunds" on refunds
  for select using (tenant_id in (select get_user_tenant_ids()));

create policy "Admins can manage refunds" on refunds
  for all using (
    tenant_id in (
      select tenant_id from memberships
      where user_id = (select id from users where auth_id = auth.uid()::text)
      and role in ('owner', 'admin')
    )
  );
