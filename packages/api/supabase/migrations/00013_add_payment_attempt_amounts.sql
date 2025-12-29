-- Track captured and refunded amounts on payment attempts
alter table payment_attempts
  add column if not exists captured_amount int not null default 0;

alter table payment_attempts
  add column if not exists refunded_amount int not null default 0;
