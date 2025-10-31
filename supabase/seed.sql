-- Seed vendor and user accounts
insert into auth.users (id, email, encrypted_password)
values
  ('00000000-0000-0000-0000-000000000001', 'vendor@example.com', crypt('password', gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000002', 'user@example.com', crypt('password', gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000003', 'admin@example.com', crypt('password', gen_salt('bf'))),
  ('10000000-0000-0000-0000-000000000001', 'canal@demo.local', crypt('password', gen_salt('bf'))),
  ('10000000-0000-0000-0000-000000000002', 'capitole@demo.local', crypt('password', gen_salt('bf'))),
  ('10000000-0000-0000-0000-000000000003', 'cuisine@demo.local', crypt('password', gen_salt('bf'))),
  ('10000000-0000-0000-0000-000000000004', 'jeux@demo.local', crypt('password', gen_salt('bf')))
  on conflict (id) do nothing;

insert into profiles (id, name, role_id)
values
  ('00000000-0000-0000-0000-000000000001', 'Vendor Demo', 1),
  ('00000000-0000-0000-0000-000000000002', 'User Demo', 2),
  ('00000000-0000-0000-0000-000000000003', 'Admin Demo', 2),
  ('10000000-0000-0000-0000-000000000001', 'Collectif Toulouse Sport', 1),
  ('10000000-0000-0000-0000-000000000002', 'Guides de Toulouse', 1),
  ('10000000-0000-0000-0000-000000000003', 'Les Toqués Toulousains', 1),
  ('10000000-0000-0000-0000-000000000004', 'Association Meeples Occitans', 1)
  on conflict (id) do nothing;

insert into vendor_accounts (profile_id, stripe_account_id, onboarding_complete)
values
  ('00000000-0000-0000-0000-000000000001', 'acct_demo', true),
  ('10000000-0000-0000-0000-000000000001', 'acct_demo_canal', true),
  ('10000000-0000-0000-0000-000000000002', 'acct_demo_capitole', true),
  ('10000000-0000-0000-0000-000000000003', 'acct_demo_cuisine', true),
  ('10000000-0000-0000-0000-000000000004', 'acct_demo_jeux', true)
  on conflict (profile_id) do nothing;

-- Seed demo events for the catalogue
insert into events (id, vendor_id, title, description, category, price_cents, currency, max_places, geom, address)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Balade photo au centre de Toulouse',
    'Partez pour une promenade guidée dans les ruelles toulousaines afin de perfectionner votre œil de photographe.',
    'culture',
    2500,
    'EUR',
    12,
    st_setsrid(st_makepoint(1.444209, 43.604652), 4326),
    'Place du Capitole, 31000 Toulouse'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000001',
    'Atelier de pâtisserie occitane',
    'Réalisez les meilleures spécialités sucrées de la région avec un chef local et repartez avec vos créations.',
    'food',
    4500,
    'EUR',
    8,
    st_setsrid(st_makepoint(1.452362, 43.603444), 4326),
    '12 Rue des Arts, 31000 Toulouse'
  )
  on conflict (id) do nothing;

insert into event_slots (id, event_id, start_at, end_at, booked_places)
values
  (
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111111',
    '2025-06-01 08:00:00+02',
    '2025-06-01 10:30:00+02',
    0
  ),
  (
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '11111111-1111-1111-1111-111111111111',
    '2025-06-08 08:00:00+02',
    '2025-06-08 10:30:00+02',
    0
  ),
  (
    'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    '22222222-2222-2222-2222-222222222222',
    '2025-06-05 14:00:00+02',
    '2025-06-05 17:00:00+02',
    0
  ),
  (
    'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    '22222222-2222-2222-2222-222222222222',
    '2025-06-12 14:00:00+02',
    '2025-06-12 17:00:00+02',
    0
  )
  on conflict (id) do nothing;

insert into user_roles (user_id, role)
values
  ('00000000-0000-0000-0000-000000000003', 'admin')
  on conflict (user_id, role) do nothing;
