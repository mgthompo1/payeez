-- Store routing profile overrides for payment attempts
alter table payment_attempts
  add column if not exists routing_profile_id uuid references orchestration_profiles(id) on delete set null;
