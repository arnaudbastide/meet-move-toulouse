-- Seed vendor and user accounts
insert into auth.users (id, email, encrypted_password)
values
  ('00000000-0000-0000-0000-000000000001', 'vendor@example.com', crypt('password', gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000002', 'user@example.com', crypt('password', gen_salt('bf')))
  on conflict (id) do nothing;

insert into profiles (id, name, role_id)
values
  ('00000000-0000-0000-0000-000000000001', 'Vendor Demo', 1),
  ('00000000-0000-0000-0000-000000000002', 'User Demo', 2)
  on conflict (id) do nothing;

insert into vendor_accounts (profile_id, stripe_account_id, onboarding_complete)
values
  ('00000000-0000-0000-0000-000000000001', 'acct_demo', true)
  on conflict (profile_id) do nothing;
