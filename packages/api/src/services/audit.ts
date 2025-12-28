// ============================================
// Audit Logging Service
// Immutable audit trail for PCI compliance
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed_login'
  | 'auth.password_reset'
  // API Keys
  | 'api_key.created'
  | 'api_key.revoked'
  | 'api_key.used'
  // Credentials
  | 'credential.created'
  | 'credential.updated'
  | 'credential.deleted'
  | 'credential.viewed'
  // Payments
  | 'payment.session_created'
  | 'payment.confirmed'
  | 'payment.captured'
  | 'payment.refunded'
  | 'payment.voided'
  | 'payment.failed'
  // Webhooks
  | 'webhook.received'
  | 'webhook.delivered'
  | 'webhook.failed'
  // Settings
  | 'settings.updated'
  | 'routing.updated'
  | 'team.member_added'
  | 'team.member_removed'

export type ResourceType =
  | 'api_key'
  | 'credential'
  | 'session'
  | 'payment'
  | 'refund'
  | 'webhook'
  | 'token'
  | 'user'
  | 'tenant'
  | 'routing_rule'

interface AuditLogEntry {
  tenant_id: string
  user_id?: string
  action: AuditAction
  resource_type: ResourceType
  resource_id: string
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, unknown>
  // Sensitive data is hashed, not stored in plaintext
  sensitive_data_hash?: string
}

export class AuditService {
  private supabase: SupabaseClient
  private tenantId: string

  constructor(supabase: SupabaseClient, tenantId: string) {
    this.supabase = supabase
    this.tenantId = tenantId
  }

  /**
   * Log an audit event
   */
  async log(entry: Omit<AuditLogEntry, 'tenant_id'>): Promise<void> {
    try {
      await this.supabase.from('audit_logs').insert({
        tenant_id: this.tenantId,
        ...entry,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      // Audit logging should never fail silently
      // Log to stderr for monitoring systems to pick up
      console.error('[AUDIT_FAILURE]', JSON.stringify({
        tenant_id: this.tenantId,
        ...entry,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }))
    }
  }

  /**
   * Log API key usage
   */
  async logApiKeyUsage(
    keyId: string,
    endpoint: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      action: 'api_key.used',
      resource_type: 'api_key',
      resource_id: keyId,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { endpoint },
    })
  }

  /**
   * Log payment event
   */
  async logPayment(
    action: 'payment.session_created' | 'payment.confirmed' | 'payment.captured' | 'payment.refunded' | 'payment.voided' | 'payment.failed',
    sessionId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action,
      resource_type: 'session',
      resource_id: sessionId,
      metadata,
    })
  }

  /**
   * Log credential access
   */
  async logCredentialAccess(
    action: 'credential.created' | 'credential.updated' | 'credential.deleted' | 'credential.viewed',
    credentialId: string,
    psp: string,
    userId?: string
  ): Promise<void> {
    await this.log({
      action,
      resource_type: 'credential',
      resource_id: credentialId,
      user_id: userId,
      metadata: { psp },
    })
  }

  /**
   * Query audit logs with filters
   */
  async query(filters: {
    action?: AuditAction
    resource_type?: ResourceType
    resource_id?: string
    user_id?: string
    start_date?: Date
    end_date?: Date
    limit?: number
    offset?: number
  }): Promise<{
    logs: Array<AuditLogEntry & { id: string; created_at: string }>
    total: number
  }> {
    let query = this.supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', this.tenantId)
      .order('created_at', { ascending: false })

    if (filters.action) {
      query = query.eq('action', filters.action)
    }
    if (filters.resource_type) {
      query = query.eq('resource_type', filters.resource_type)
    }
    if (filters.resource_id) {
      query = query.eq('resource_id', filters.resource_id)
    }
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id)
    }
    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date.toISOString())
    }
    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date.toISOString())
    }

    const limit = filters.limit || 50
    const offset = filters.offset || 0

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      throw error
    }

    return {
      logs: data || [],
      total: count || 0,
    }
  }

  /**
   * Export audit logs for compliance
   */
  async export(startDate: Date, endDate: Date): Promise<string> {
    const { logs } = await this.query({
      start_date: startDate,
      end_date: endDate,
      limit: 100000, // Max export size
    })

    // Convert to CSV
    const headers = [
      'id',
      'timestamp',
      'action',
      'resource_type',
      'resource_id',
      'user_id',
      'ip_address',
      'user_agent',
      'metadata',
    ].join(',')

    const rows = logs.map(log => [
      log.id,
      log.created_at,
      log.action,
      log.resource_type,
      log.resource_id,
      log.user_id || '',
      log.ip_address || '',
      log.user_agent || '',
      JSON.stringify(log.metadata || {}),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

    return [headers, ...rows].join('\n')
  }
}

/**
 * Audit log table migration
 * Add this to your migrations
 */
export const AUDIT_LOG_MIGRATION = `
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

-- Indexes for common queries
create index idx_audit_logs_tenant on audit_logs(tenant_id);
create index idx_audit_logs_action on audit_logs(action);
create index idx_audit_logs_resource on audit_logs(resource_type, resource_id);
create index idx_audit_logs_created on audit_logs(created_at);

-- Enable RLS
alter table audit_logs enable row level security;

-- Policy: tenants can only read their own logs
create policy "Tenants can read own audit logs" on audit_logs
  for select using (tenant_id = get_current_tenant_id());

-- Policy: only system can insert (via service role)
create policy "System can insert audit logs" on audit_logs
  for insert with check (true);

-- Prevent updates and deletes (immutable)
-- No update or delete policies = no modifications allowed
`
