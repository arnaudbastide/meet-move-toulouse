-- 2.1 Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pgcrypto";

-- 2.2 Roles table (immutable after insert)
create table roles(
  id int primary key,
  name text unique check (name in ('vendor','user'))
);
insert into roles(id,name) values (1,'vendor'),(2,'user');

-- 2.3 Profiles
create table profiles(
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  avatar_url text,
  role_id int not null references roles,
  created_at timestamptz default now(),
  constraint one_role_per_profile unique (id,role_id)
);

-- 2.4 Events
create table events(
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  category text check (category in ('sport','culture','food','games','other')),
  price_cents int not null check (price_cents >= 0), -- 0 = free
  currency text default 'eur',
  max_places int not null check (max_places > 0),
  geom geometry(Point,4326) not null,
  address text not null,
  status text default 'published' check (status in ('published','cancelled')),
  created_at timestamptz default now()
);

-- 2.5 Slots
create table event_slots(
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  booked_places int default 0 check (booked_places <= (select max_places from events where id = event_id)),
  unique(event_id,start_at)
);

-- 2.6 Bookings (+ payment intent)
create table bookings(
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  slot_id uuid not null references event_slots on delete cascade,
  status text default 'booked' check (status in ('booked','cancelled','checked_in')),
  price_cents int not null,
  platform_fee_cents int not null,
  net_payout_cents int not null, -- vendor receives this
  payment_intent_id text unique,
  created_at timestamptz default now(),
  constraint one_booking_per_user_slot unique (user_id,slot_id)
);

-- 2.7 Vendor Stripe accounts
create table vendor_accounts(
  profile_id uuid primary key references profiles(id) on delete cascade,
  stripe_account_id text unique not null,
  onboarding_complete boolean default false,
  created_at timestamptz default now()
);

-- 2.8 RLS
alter table profiles enable row level security;
alter table events enable row level security;
alter table event_slots enable row level security;
alter table bookings enable row level security;
alter table vendor_accounts enable row level security;

-- profiles
create policy "Public read profiles" on profiles for select using (true);
create policy "Users insert own profile" on profiles for insert with check (auth.uid()=id);
create policy "Users update own profile" on profiles for update using (auth.uid()=id);

-- events
create policy "Anyone read events" on events for select using (status='published');
create policy "Vendor insert own event" on events for insert with check (auth.uid()=vendor_id and (select role_id from profiles where id=auth.uid())=1);

-- slots
create policy "Anyone read slots" on event_slots for select using (true);
create policy "Vendor manage own slots" on event_slots for all using (auth.uid()=(select vendor_id from events where id=event_id));

-- bookings
create policy "User read own booking" on bookings for select using (auth.uid()=user_id);
create policy "User insert booking" on bookings for insert with check (auth.uid()=user_id and (select role_id from profiles where id=auth.uid())=2);

-- vendor_accounts
create policy "Vendor read own account" on vendor_accounts for select using (auth.uid()=profile_id);

-- 2.9 RPCs
-- create event + slots
create or replace function create_event_with_slots(
  p_title text, p_desc text, p_cat text, p_price_cents int, p_max int,
  p_lat float, p_lng float, p_addr text, p_slots jsonb
) returns uuid as $$
declare v_event_id uuid;
begin
  insert into events(vendor_id,title,description,category,price_cents,max_places,geom,address)
  values (auth.uid(),p_title,p_desc,p_cat,p_price_cents,p_max,st_setsrid(st_makepoint(p_lng,p_lat),4326),p_addr)
  returning id into v_event_id;
  insert into event_slots(event_id,start_at,end_at)
  select v_event_id, (j->>'start_at')::timestamptz, (j->>'end_at')::timestamptz
  from jsonb_array_elements(p_slots) j;
  return v_event_id;
end; $$ language plpgsql security definer;

-- book slot (with payment)
create or replace function book_slot(p_slot_id uuid, p_payment_intent_id text)
returns uuid as $$
declare
  v_event record; v_booking uuid; v_platform_fee int; v_net int;
begin
  select e.price_cents, e.max_places, s.booked_places into v_event
  from event_slots s join events e on e.id=s.event_id where s.id=p_slot_id for update;
  if not found then raise exception 'SLOT_NOT_FOUND'; end if;
  if v_event.booked_places >= v_event.max_places then raise exception 'SLOT_FULL'; end if;
  v_platform_fee := ceil(v_event.price_cents * 0.10);
  v_net := v_event.price_cents - v_platform_fee;
  update event_slots set booked_places=booked_places+1 where id=p_slot_id;
  insert into bookings(user_id,slot_id,price_cents,platform_fee_cents,net_payout_cents,payment_intent_id)
  values (auth.uid(),p_slot_id,v_event.price_cents,v_platform_fee,v_net,p_payment_intent_id)
  returning id into v_booking;
  return v_booking;
end; $$ language plpgsql security definer;

-- cancel + refund
create or replace function cancel_booking(p_booking_id uuid)
returns void as $$
declare v_pi text; v_slot timestamptz;
begin
  select payment_intent_id, s.start_at into v_pi, v_slot
  from bookings b join event_slots s on s.id=b.slot_id
  where b.id=p_booking_id and b.user_id=auth.uid();
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_slot < now() + interval '24 hours' then raise exception 'CANCELLATION_WINDOW_CLOSED'; end if;
  update bookings set status='cancelled' where id=p_booking_id;
  update event_slots set booked_places=booked_places-1 where id=(select slot_id from bookings where id=p_booking_id);
  -- (Stripe refund will be triggered by webhook)
end; $$ language plpgsql security definer;
