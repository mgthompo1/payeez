-- ============================================
-- User Onboarding Trigger
-- Auto-creates user, tenant, and membership on signup
-- ============================================

-- Function to handle new user registration
create or replace function handle_new_user()
returns trigger as $$
declare
  new_tenant_id uuid;
  new_user_id uuid;
  user_name text;
  tenant_name text;
begin
  -- Get user name from metadata or email
  user_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Create tenant name from user's name or email
  tenant_name := coalesce(
    new.raw_user_meta_data->>'company',
    user_name || '''s Organization'
  );

  -- Create tenant
  insert into public.tenants (name, slug, environment)
  values (
    tenant_name,
    lower(regexp_replace(new.email, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8),
    'test'
  )
  returning id into new_tenant_id;

  -- Create user record
  insert into public.users (email, auth_id, name)
  values (new.email, new.id::text, user_name)
  returning id into new_user_id;

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

  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================
-- Helper function to get current user's tenant
-- ============================================

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
-- RLS Policies using the helper function
-- ============================================

-- Drop existing policies if they exist
drop policy if exists "Users can view own tenant's API keys" on api_keys;
drop policy if exists "Users can create API keys for own tenant" on api_keys;
drop policy if exists "Users can revoke own tenant's API keys" on api_keys;

-- API Keys policies
create policy "Users can view own tenant's API keys" on api_keys
  for select using (tenant_id = get_current_tenant_id());

create policy "Users can create API keys for own tenant" on api_keys
  for insert with check (tenant_id = get_current_tenant_id());

create policy "Users can revoke own tenant's API keys" on api_keys
  for update using (tenant_id = get_current_tenant_id());

-- ============================================
-- Function to generate new API key
-- ============================================

create or replace function generate_api_key(
  p_label text,
  p_environment text default 'test'
)
returns table (
  id uuid,
  key_prefix text,
  full_key text,
  label text,
  environment text,
  created_at timestamptz
) as $$
declare
  v_tenant_id uuid;
  v_key_id uuid;
  v_raw_key text;
  v_prefix text;
begin
  -- Get current user's tenant
  v_tenant_id := get_current_tenant_id();

  if v_tenant_id is null then
    raise exception 'User does not belong to any tenant';
  end if;

  -- Generate prefix based on environment
  v_prefix := case p_environment
    when 'live' then 'sk_live_'
    else 'sk_test_'
  end;

  -- Generate a random key (32 chars of alphanumeric)
  v_raw_key := encode(gen_random_bytes(24), 'base64');
  v_raw_key := regexp_replace(v_raw_key, '[^a-zA-Z0-9]', '', 'g');
  v_raw_key := substr(v_raw_key, 1, 32);

  -- Insert the API key with hashed value
  insert into public.api_keys (tenant_id, key_prefix, key_hash, label, environment)
  values (
    v_tenant_id,
    v_prefix,
    crypt(v_raw_key, gen_salt('bf')),
    p_label,
    p_environment
  )
  returning api_keys.id, api_keys.key_prefix, api_keys.label, api_keys.environment, api_keys.created_at
  into v_key_id, id, key_prefix, label, environment, created_at;

  -- Return the full key (only time it's visible)
  full_key := v_prefix || v_raw_key;

  return next;
end;
$$ language plpgsql security definer;

-- ============================================
-- Function to list API keys for current tenant
-- ============================================

create or replace function list_api_keys()
returns table (
  id uuid,
  key_prefix text,
  label text,
  environment text,
  last_used_at timestamptz,
  created_at timestamptz,
  is_revoked boolean
) as $$
begin
  return query
  select
    ak.id,
    ak.key_prefix,
    ak.label,
    ak.environment,
    ak.last_used_at,
    ak.created_at,
    (ak.revoked_at is not null) as is_revoked
  from api_keys ak
  where ak.tenant_id = get_current_tenant_id()
  order by ak.created_at desc;
end;
$$ language plpgsql security definer;

-- ============================================
-- Function to revoke an API key
-- ============================================

create or replace function revoke_api_key(p_key_id uuid)
returns boolean as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := get_current_tenant_id();

  update api_keys
  set revoked_at = now()
  where id = p_key_id
    and tenant_id = v_tenant_id
    and revoked_at is null;

  return found;
end;
$$ language plpgsql security definer;

-- ============================================
-- Function to validate an API key (for edge functions)
-- ============================================

create or replace function validate_api_key(p_full_key text)
returns table (
  tenant_id uuid,
  environment text,
  is_valid boolean
) as $$
declare
  v_prefix text;
  v_key_part text;
  v_record record;
begin
  -- Extract prefix and key part
  if p_full_key like 'sk_live_%' then
    v_prefix := 'sk_live_';
    v_key_part := substr(p_full_key, 9);
  elsif p_full_key like 'sk_test_%' then
    v_prefix := 'sk_test_';
    v_key_part := substr(p_full_key, 9);
  else
    return query select null::uuid, null::text, false;
    return;
  end if;

  -- Find matching key
  for v_record in
    select ak.tenant_id, ak.environment, ak.key_hash, ak.id
    from api_keys ak
    where ak.key_prefix = v_prefix
      and ak.revoked_at is null
  loop
    if v_record.key_hash = crypt(v_key_part, v_record.key_hash) then
      -- Update last used timestamp
      update api_keys set last_used_at = now() where id = v_record.id;

      return query select v_record.tenant_id, v_record.environment, true;
      return;
    end if;
  end loop;

  -- No match found
  return query select null::uuid, null::text, false;
end;
$$ language plpgsql security definer;
