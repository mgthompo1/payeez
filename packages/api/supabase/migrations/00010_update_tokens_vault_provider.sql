-- Allow VGS as a vault provider for tokens
alter table tokens drop constraint if exists tokens_vault_provider_check;
alter table tokens add constraint tokens_vault_provider_check
  check (vault_provider in ('basis_theory', 'vgs'));
