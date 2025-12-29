-- ============================================
-- Refunds (ledger of refund transactions)
-- ============================================

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid references payment_attempts(id) on delete cascade not null,
  session_id uuid references payment_sessions(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,
  psp text not null check (psp in ('stripe', 'adyen', 'authorizenet', 'chase', 'nuvei', 'dlocal', 'braintree', 'checkoutcom', 'airwallex')),
  psp_refund_id text,
  amount int not null,
  currency text not null,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  reason text,
  idempotency_key text,
  raw_response jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (idempotency_key)
);

create index idx_refunds_payment_attempt on refunds(payment_attempt_id);
create index idx_refunds_session on refunds(session_id);

create trigger refunds_updated_at before update on refunds
  for each row execute function update_updated_at();
