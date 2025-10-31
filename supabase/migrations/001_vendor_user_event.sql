-- 1. Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pgcrypto";

-- 2. Roles table (immutable after insert)
create table roles (
  id int primary key,
  name text unique check (name in ('vendor', 'user'))
);

insert into roles (id, name)
values (1, 'vendor'), (2, 'user')
on conflict (id) do nothing;

-- 3. Profiles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  avatar_url text,
  role_id int not null references roles(id),
  created_at timestamptz default now(),
  constraint one_role_per_profile unique (id, role_id)
);

-- 4. Events
create table events (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  category text check (category in ('sport', 'culture', 'food', 'games', 'other')),
  image_url text,
  price_cents int not null check (price_cents >= 0),
  currency text default 'eur',
  max_places int not null check (max_places > 0),
  geom geometry(Point, 4326) not null,
  address text not null,
  status text default 'published' check (status in ('published', 'cancelled')),
  created_at timestamptz default now()
);

create index on events (vendor_id);
create index on events using gist (geom);

-- 5. Slots
create table event_slots (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  booked_places int default 0 not null check (booked_places >= 0),
  created_at timestamptz default now(),
  unique (event_id, start_at),
  constraint slot_time_range check (end_at > start_at)
);

create index on event_slots (event_id);
create index on event_slots (start_at);

-- 6. Bookings (+ payment intent)
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  slot_id uuid not null references event_slots(id) on delete cascade,
  status text default 'booked' check (status in ('booked', 'cancelled', 'checked_in')),
  price_cents int not null,
  platform_fee_cents int not null,
  net_payout_cents int not null,
  payment_intent_id text unique,
  transfer_group text,
  created_at timestamptz default now(),
  constraint one_booking_per_user_slot unique (user_id, slot_id)
);

create index on bookings (user_id);
create index on bookings (slot_id);

-- 7. Vendor Stripe accounts
create table vendor_accounts (
  profile_id uuid primary key references profiles(id) on delete cascade,
  stripe_account_id text unique not null,
  onboarding_complete boolean default false,
  created_at timestamptz default now()
);

-- 8. Enable RLS
alter table profiles enable row level security;
alter table events enable row level security;
alter table event_slots enable row level security;
alter table bookings enable row level security;
alter table vendor_accounts enable row level security;

-- profiles policies
create policy "Public read profiles" on profiles for select using (true);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- events policies
create policy "Anyone read published events" on events for select using (status = 'published');
create policy "Vendors read own events" on events for select using (auth.uid() = vendor_id);
create policy "Vendors insert events" on events for insert
  with check (
    auth.uid() = vendor_id
    and (select role_id from profiles where id = auth.uid()) = 1
  );
create policy "Vendors update events" on events for update
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);
create policy "Vendors delete events" on events for delete using (auth.uid() = vendor_id);

-- slots policies
create policy "Anyone read slots" on event_slots for select using (true);
create policy "Vendors insert slots" on event_slots for insert
  with check (auth.uid() = (select vendor_id from events where id = event_id));
create policy "Vendors update slots" on event_slots for update
  using (auth.uid() = (select vendor_id from events where id = event_id))
  with check (auth.uid() = (select vendor_id from events where id = event_id));
create policy "Vendors delete slots" on event_slots for delete
  using (auth.uid() = (select vendor_id from events where id = event_id));

-- bookings policies
create policy "Users read own bookings" on bookings for select using (auth.uid() = user_id);
create policy "Users insert booking" on bookings for insert
  with check (
    auth.uid() = user_id
    and (select role_id from profiles where id = auth.uid()) = 2
  );
create policy "Vendors read event bookings" on bookings for select
  using (
    exists (
      select 1
      from event_slots s
      join events e on e.id = s.event_id
      where s.id = bookings.slot_id
        and e.vendor_id = auth.uid()
    )
  );

-- vendor accounts policies
create policy "Vendors read own account" on vendor_accounts for select using (auth.uid() = profile_id);

-- 9. RPCs
create or replace function create_event_with_slots(
  p_title text,
  p_desc text,
  p_cat text,
  p_price_cents int,
  p_max int,
  p_lat double precision,
  p_lng double precision,
  p_addr text,
  p_slots jsonb,
  p_image_url text default null
) returns uuid as $$
declare
  v_event_id uuid;
begin
  insert into events (vendor_id, title, description, category, price_cents, max_places, geom, address, image_url)
  values (
    auth.uid(),
    p_title,
    nullif(p_desc, ''),
    p_cat,
    p_price_cents,
    p_max,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326),
    p_addr,
    nullif(p_image_url, '')
  )
  returning id into v_event_id;

  insert into event_slots (event_id, start_at, end_at)
  select
    v_event_id,
    (slot ->> 'start_at')::timestamptz,
    (slot ->> 'end_at')::timestamptz
  from jsonb_array_elements(p_slots) as slot;

  return v_event_id;
end;
$$ language plpgsql security definer;

create or replace function book_slot(
  p_slot_id uuid,
  p_payment_intent_id text
) returns uuid as $$
declare
  v_event record;
  v_booking uuid;
  v_platform_fee int;
  v_net int;
begin
  select
    e.price_cents,
    e.max_places,
    s.booked_places
  into v_event
  from event_slots s
  join events e on e.id = s.event_id
  where s.id = p_slot_id
  for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if v_event.booked_places >= v_event.max_places then
    raise exception 'SLOT_FULL';
  end if;

  v_platform_fee := ceil(v_event.price_cents * 0.10);
  v_net := v_event.price_cents - v_platform_fee;

  update event_slots
  set booked_places = booked_places + 1
  where id = p_slot_id;

  insert into bookings (
    user_id,
    slot_id,
    price_cents,
    platform_fee_cents,
    net_payout_cents,
    payment_intent_id
  )
  values (
    auth.uid(),
    p_slot_id,
    v_event.price_cents,
    v_platform_fee,
    v_net,
    p_payment_intent_id
  )
  returning id into v_booking;

  return v_booking;
end;
$$ language plpgsql security definer;

create or replace function cancel_booking(
  p_booking_id uuid
) returns void as $$
declare
  v_pi text;
  v_slot timestamptz;
  v_status text;
  v_slot_id uuid;
begin
  select
    payment_intent_id,
    s.start_at,
    b.status,
    b.slot_id
  into v_pi,
    v_slot,
    v_status,
    v_slot_id
  from bookings b
  join event_slots s on s.id = b.slot_id
  where b.id = p_booking_id
    and b.user_id = auth.uid();

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_status <> 'booked' then
    raise exception 'BOOKING_NOT_ACTIVE';
  end if;

  if v_slot < now() + interval '24 hours' then
    raise exception 'CANCELLATION_WINDOW_CLOSED';
  end if;

  update bookings
  set status = 'cancelled'
  where id = p_booking_id;

  update event_slots
  set booked_places = greatest(booked_places - 1, 0)
  where id = v_slot_id;

  -- Stripe refund handled via webhook
end;
$$ language plpgsql security definer;
