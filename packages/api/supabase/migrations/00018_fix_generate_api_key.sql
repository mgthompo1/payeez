-- ============================================
-- Fix generate_api_key function
-- The RETURNING...INTO was assigning values to wrong variables
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
  returning
    api_keys.id,
    api_keys.key_prefix,
    api_keys.label,
    api_keys.environment,
    api_keys.created_at
  into
    generate_api_key.id,
    generate_api_key.key_prefix,
    generate_api_key.label,
    generate_api_key.environment,
    generate_api_key.created_at;

  -- Return the full key (only time it's visible)
  full_key := v_prefix || v_raw_key;

  return next;
end;
$$ language plpgsql security definer;
