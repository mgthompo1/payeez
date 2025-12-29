-- Allow refunded status for payment attempts
alter table payment_attempts
  drop constraint if exists payment_attempts_status_check;

alter table payment_attempts
  add constraint payment_attempts_status_check
  check (status in ('pending', 'authorized', 'captured', 'failed', 'canceled', 'refunded'));
