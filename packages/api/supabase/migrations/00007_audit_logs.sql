-- ============================================
-- Migration: 00007_audit_logs.sql
-- Description: Immutable audit logging for PCI compliance
-- ============================================

-- Audit logs table (append-only)
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references users(id),
  action text not null,
  resource_type text not null,
  resource_id text not null,
  ip_address inet,
  user_agent text,
  metadata jsonb default '{}',
  sensitive_data_hash text,
  created_at timestamptz not null default now()
);

-- Add comments
comment on table audit_logs is 'Immutable audit trail for PCI DSS compliance';
comment on column audit_logs.action is 'The action performed (e.g., payment.captured, credential.viewed)';
comment on column audit_logs.resource_type is 'The type of resource affected (e.g., session, credential)';
comment on column audit_logs.resource_id is 'The ID of the affected resource';
comment on column audit_logs.sensitive_data_hash is 'SHA-256 hash of any sensitive data for forensics without storing plaintext';

-- Indexes for common queries
create index idx_audit_logs_tenant on audit_logs(tenant_id);
create index idx_audit_logs_action on audit_logs(action);
create index idx_audit_logs_resource on audit_logs(resource_type, resource_id);
create index idx_audit_logs_created on audit_logs(created_at);
create index idx_audit_logs_user on audit_logs(user_id) where user_id is not null;

-- Composite index for common query patterns
create index idx_audit_logs_tenant_created on audit_logs(tenant_id, created_at desc);
create index idx_audit_logs_tenant_action on audit_logs(tenant_id, action);

-- Enable RLS
alter table audit_logs enable row level security;

-- Policy: tenants can only read their own logs
create policy "Tenants can read own audit logs" on audit_logs
  for select using (tenant_id = get_current_tenant_id());

-- Policy: only system can insert (via service role)
create policy "System can insert audit logs" on audit_logs
  for insert with check (true);

-- Note: No UPDATE or DELETE policies - audit logs are immutable

-- ============================================
-- Trigger to prevent updates and deletes
-- ============================================

create or replace function prevent_audit_log_modification()
returns trigger as $$
begin
  raise exception 'Audit logs are immutable and cannot be modified or deleted';
end;
$$ language plpgsql;

create trigger audit_logs_immutable_update
  before update on audit_logs
  for each row execute function prevent_audit_log_modification();

create trigger audit_logs_immutable_delete
  before delete on audit_logs
  for each row execute function prevent_audit_log_modification();

-- ============================================
-- Helper function to log audit events
-- ============================================

create or replace function log_audit_event(
  p_tenant_id uuid,
  p_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_ip_address inet default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'
)
returns uuid as $$
declare
  v_id uuid;
begin
  insert into audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    metadata
  ) values (
    p_tenant_id,
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_ip_address,
    p_user_agent,
    p_metadata
  ) returning id into v_id;

  return v_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- Automatic audit triggers for sensitive tables
-- ============================================

-- Audit API key changes
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
  elsif TG_OP = 'UPDATE' and old.is_active = true and new.is_active = false then
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

create trigger api_keys_audit
  after insert or update on api_keys
  for each row execute function audit_api_key_changes();

-- Audit PSP credential changes
create or replace function audit_psp_credential_changes()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    perform log_audit_event(
      new.tenant_id,
      null,
      'credential.created',
      'credential',
      new.id::text,
      null,
      null,
      jsonb_build_object('psp', new.psp, 'environment', new.environment)
    );
  elsif TG_OP = 'UPDATE' then
    perform log_audit_event(
      new.tenant_id,
      null,
      'credential.updated',
      'credential',
      new.id::text,
      null,
      null,
      jsonb_build_object('psp', new.psp, 'environment', new.environment)
    );
  elsif TG_OP = 'DELETE' then
    perform log_audit_event(
      old.tenant_id,
      null,
      'credential.deleted',
      'credential',
      old.id::text,
      null,
      null,
      jsonb_build_object('psp', old.psp)
    );
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger psp_credentials_audit
  after insert or update or delete on psp_credentials
  for each row execute function audit_psp_credential_changes();

-- Audit payment session status changes
create or replace function audit_payment_session_changes()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    perform log_audit_event(
      new.tenant_id,
      null,
      'payment.session_created',
      'session',
      new.id::text,
      null,
      null,
      jsonb_build_object('amount', new.amount, 'currency', new.currency)
    );
  elsif TG_OP = 'UPDATE' and old.status != new.status then
    perform log_audit_event(
      new.tenant_id,
      null,
      case new.status
        when 'succeeded' then 'payment.captured'
        when 'failed' then 'payment.failed'
        when 'canceled' then 'payment.voided'
        when 'refunded' then 'payment.refunded'
        else 'payment.confirmed'
      end,
      'session',
      new.id::text,
      null,
      null,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'amount', new.amount,
        'currency', new.currency
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger payment_sessions_audit
  after insert or update on payment_sessions
  for each row execute function audit_payment_session_changes();

-- ============================================
-- Audit log retention policy (optional)
-- ============================================

-- Function to archive old audit logs (call via scheduled job)
create or replace function archive_old_audit_logs(retention_days integer default 365)
returns integer as $$
declare
  archived_count integer;
begin
  -- In production, you'd move these to cold storage (S3, etc.)
  -- For now, we just count what would be archived
  select count(*) into archived_count
  from audit_logs
  where created_at < now() - (retention_days || ' days')::interval;

  -- Log the archive operation itself
  if archived_count > 0 then
    insert into audit_logs (
      tenant_id,
      action,
      resource_type,
      resource_id,
      metadata
    )
    select distinct
      tenant_id,
      'settings.updated',
      'tenant',
      tenant_id::text,
      jsonb_build_object('operation', 'audit_archive', 'count', archived_count)
    from audit_logs
    where created_at < now() - (retention_days || ' days')::interval;
  end if;

  return archived_count;
end;
$$ language plpgsql security definer;

-- ============================================
-- Views for common audit queries
-- ============================================

-- Recent activity view
create or replace view recent_audit_activity as
select
  al.id,
  al.tenant_id,
  al.action,
  al.resource_type,
  al.resource_id,
  al.ip_address,
  al.created_at,
  u.email as user_email
from audit_logs al
left join users u on al.user_id = u.id
where al.created_at > now() - interval '7 days'
order by al.created_at desc;

-- Security events view (failed logins, credential access, etc.)
create or replace view security_audit_events as
select
  al.id,
  al.tenant_id,
  al.action,
  al.resource_type,
  al.resource_id,
  al.ip_address,
  al.user_agent,
  al.created_at,
  al.metadata
from audit_logs al
where al.action in (
  'auth.failed_login',
  'credential.created',
  'credential.updated',
  'credential.deleted',
  'credential.viewed',
  'api_key.created',
  'api_key.revoked'
)
order by al.created_at desc;
