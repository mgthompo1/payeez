-- ============================================
-- Normalize webhook event defaults to payment.captured
-- ============================================

alter table merchant_webhooks
  alter column events set default array['payment.captured', 'payment.failed', 'refund.succeeded'];

update merchant_webhooks
  set events = array_replace(events, 'payment.succeeded', 'payment.captured')
  where events @> array['payment.succeeded'];
