-- ============================================
-- Fix api_keys audit trigger
-- The trigger referenced is_active but api_keys uses revoked_at
-- ============================================

create or replace function audit_api_key_changes()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    perform log_audit_event(
      new.tenant_id,
      null,
      'api_key.created',
      'api_key',
      new.id::text,
      null,
      null,
      jsonb_build_object('key_prefix', new.key_prefix, 'environment', new.environment)
    );
  elsif TG_OP = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
    perform log_audit_event(
      new.tenant_id,
      null,
      'api_key.revoked',
      'api_key',
      new.id::text,
      null,
      null,
      jsonb_build_object('key_prefix', new.key_prefix)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;
