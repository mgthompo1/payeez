-- ============================================
-- Fix for existing users without tenant
-- Manually creates tenant/membership for users
-- who signed up before the trigger was installed
-- ============================================

-- Function to onboard an existing auth user who doesn't have a tenant
create or replace function onboard_existing_user()
returns void as $$
declare
  v_auth_user record;
  v_existing_user record;
  new_tenant_id uuid;
  new_user_id uuid;
  user_name text;
  tenant_name text;
begin
  -- Get current auth user
  select id, email, raw_user_meta_data
  into v_auth_user
  from auth.users
  where id = auth.uid();

  if v_auth_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Check if user already has a record in users table
  select * into v_existing_user
  from users
  where auth_id = v_auth_user.id::text;

  -- If user already exists and has a membership, nothing to do
  if v_existing_user is not null then
    if exists (select 1 from memberships where user_id = v_existing_user.id) then
      raise notice 'User already has a tenant membership';
      return;
    end if;
  end if;

  -- Get user name from metadata or email
  user_name := coalesce(
    v_auth_user.raw_user_meta_data->>'name',
    split_part(v_auth_user.email, '@', 1)
  );

  -- Create tenant name
  tenant_name := coalesce(
    v_auth_user.raw_user_meta_data->>'company',
    user_name || '''s Organization'
  );

  -- Create tenant
  insert into public.tenants (name, slug, environment)
  values (
    tenant_name,
    lower(regexp_replace(v_auth_user.email, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8),
    'test'
  )
  returning id into new_tenant_id;

  -- Create or get user record
  if v_existing_user is null then
    insert into public.users (email, auth_id, name)
    values (v_auth_user.email, v_auth_user.id::text, user_name)
    returning id into new_user_id;
  else
    new_user_id := v_existing_user.id;
  end if;

  -- Create membership (owner role)
  insert into public.memberships (user_id, tenant_id, role)
  values (new_user_id, new_tenant_id, 'owner');

  -- Create default test API key
  insert into public.api_keys (tenant_id, key_prefix, key_hash, label, environment)
  values (
    new_tenant_id,
    'sk_test_',
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    'Default Test Key',
    'test'
  );

  raise notice 'User onboarded successfully with tenant %', new_tenant_id;
end;
$$ language plpgsql security definer;

-- Grant execute to authenticated users
grant execute on function onboard_existing_user() to authenticated;
