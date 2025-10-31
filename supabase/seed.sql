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

-- Seed demo events for the catalogue (mirrors DEFAULT_EVENTS fallback)
insert into events (id, vendor_id, title, description, category, price_cents, currency, max_places, geom, address, status)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '10000000-0000-0000-0000-000000000001',
    'Course du canal du Midi',
    'Un footing convivial le long du canal du Midi pour découvrir Toulouse en bougeant. Accessible à tous les niveaux.',
    'sport',
    0,
    'EUR',
    40,
    st_setsrid(st_makepoint(1.4526, 43.6045), 4326),
    'Port Saint-Sauveur, Toulouse',
    'published'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '10000000-0000-0000-0000-000000000002',
    'Balade culturelle au Capitole',
    'Une visite guidée du centre historique pour découvrir l’histoire du Capitole et des lieux emblématiques de Toulouse.',
    'culture',
    1200,
    'EUR',
    25,
    st_setsrid(st_makepoint(1.4442, 43.6043), 4326),
    'Place du Capitole, Toulouse',
    'published'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '10000000-0000-0000-0000-000000000003',
    'Atelier cuisine occitane',
    'Apprenez à préparer un menu de spécialités occitanes avec un chef local et repartez avec vos créations.',
    'food',
    3500,
    'EUR',
    16,
    st_setsrid(st_makepoint(1.4272, 43.5991), 4326),
    'Marché des Carmes, Toulouse',
    'published'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '10000000-0000-0000-0000-000000000004',
    'Soirée jeux de société',
    'Rencontrez d’autres joueurs autour d’une sélection de jeux modernes et classiques, encadrée par une animatrice.',
    'games',
    800,
    'EUR',
    30,
    st_setsrid(st_makepoint(1.4398, 43.6007), 4326),
    'Ludothèque Quai des Savoirs, Toulouse',
    'published'
  )
  on conflict (id) do nothing;

insert into event_slots (id, event_id, start_at, end_at, booked_places)
values
  (
    '55555555-1111-4111-8111-555555555551',
    '11111111-1111-4111-8111-111111111111',
    '2025-12-08 09:30:00+01',
    '2025-12-08 11:00:00+01',
    0
  ),
  (
    '55555555-1111-4111-8111-555555555552',
    '11111111-1111-4111-8111-111111111111',
    '2025-12-15 09:30:00+01',
    '2025-12-15 11:00:00+01',
    0
  ),
  (
    '66666666-2222-4222-8222-666666666661',
    '22222222-2222-4222-8222-222222222222',
    '2025-12-12 15:00:00+01',
    '2025-12-12 17:00:00+01',
    0
  ),
  (
    '66666666-2222-4222-8222-666666666662',
    '22222222-2222-4222-8222-222222222222',
    '2025-12-19 15:00:00+01',
    '2025-12-19 17:00:00+01',
    0
  ),
  (
    '77777777-3333-4333-8333-777777777771',
    '33333333-3333-4333-8333-333333333333',
    '2025-12-18 18:30:00+01',
    '2025-12-18 20:30:00+01',
    0
  ),
  (
    '77777777-3333-4333-8333-777777777772',
    '33333333-3333-4333-8333-333333333333',
    '2025-12-21 18:30:00+01',
    '2025-12-21 20:30:00+01',
    0
  ),
  (
    '88888888-4444-4444-8444-888888888881',
    '44444444-4444-4444-8444-444444444444',
    '2025-12-20 19:00:00+01',
    '2025-12-20 22:30:00+01',
    0
  ),
  (
    '88888888-4444-4444-8444-888888888882',
    '44444444-4444-4444-8444-444444444444',
    '2025-12-27 19:00:00+01',
    '2025-12-27 22:30:00+01',
    0
  )
  on conflict (id) do nothing;

insert into user_roles (user_id, role)
values
  ('00000000-0000-0000-0000-000000000003', 'admin')
  on conflict (user_id, role) do nothing;
