-- ============================================
-- Add refunded status for payment sessions
-- ============================================

alter table payment_sessions
  drop constraint if exists payment_sessions_status_check;

alter table payment_sessions
  add constraint payment_sessions_status_check
  check (status in (
    'pending',
    'requires_payment_method',
    'processing',
    'succeeded',
    'failed',
    'canceled',
    'refunded'
  ));
