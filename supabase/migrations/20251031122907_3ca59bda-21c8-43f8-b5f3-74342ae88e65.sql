-- Create profiles table for user information
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles are viewable by everyone
create policy "Profiles are viewable by everyone"
on public.profiles
for select
using (true);

-- Users can update their own profile
create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id);

-- Users can insert their own profile
create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

-- Create events table
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) > 0 and char_length(title) <= 200),
  description text not null check (char_length(description) > 0 and char_length(description) <= 5000),
  category text not null check (category in ('Sports', 'Language', 'Arts', 'Food', 'Music', 'Other')),
  date date not null,
  time time not null,
  location text not null check (char_length(location) > 0 and char_length(location) <= 500),
  attendees integer not null default 0 check (attendees >= 0),
  max_attendees integer not null check (max_attendees >= 2 and max_attendees <= 1000),
  image_url text,
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  organizer_name text not null,
  organizer_initials text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint valid_attendees check (attendees <= max_attendees)
);

-- Enable RLS on events
alter table public.events enable row level security;

-- Everyone can view events (public event listings)
create policy "Events are viewable by everyone"
on public.events
for select
using (true);

-- Only authenticated users can create events
create policy "Authenticated users can create events"
on public.events
for insert
to authenticated
with check (auth.uid() = organizer_id);

-- Only event creators can update their own events
create policy "Users can update their own events"
on public.events
for update
using (auth.uid() = organizer_id);

-- Only event creators can delete their own events
create policy "Users can delete their own events"
on public.events
for delete
using (auth.uid() = organizer_id);

-- Create reservations table
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique (user_id, event_id)
);

-- Enable RLS on reservations
alter table public.reservations enable row level security;

-- Users can view their own reservations
create policy "Users can view their own reservations"
on public.reservations
for select
using (auth.uid() = user_id);

-- Users can create their own reservations
create policy "Users can create reservations"
on public.reservations
for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can delete their own reservations
create policy "Users can delete their own reservations"
on public.reservations
for delete
using (auth.uid() = user_id);

-- Event organizers can view reservations for their events
create policy "Organizers can view event reservations"
on public.reservations
for select
using (
  exists (
    select 1 from public.events
    where events.id = reservations.event_id
    and events.organizer_id = auth.uid()
  )
);

-- Trigger function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers for automatic timestamp updates
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger update_events_updated_at
  before update on public.events
  for each row execute function public.update_updated_at_column();

-- Function to increment attendee count on reservation
create or replace function public.increment_event_attendees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set attendees = attendees + 1
  where id = new.event_id
  and attendees < max_attendees;
  
  if not found then
    raise exception 'Event is full or does not exist';
  end if;
  
  return new;
end;
$$;

-- Function to decrement attendee count on cancellation
create or replace function public.decrement_event_attendees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set attendees = attendees - 1
  where id = old.event_id
  and attendees > 0;
  
  return old;
end;
$$;

-- Triggers for attendee count management
create trigger on_reservation_created
  before insert on public.reservations
  for each row execute function public.increment_event_attendees();

create trigger on_reservation_deleted
  after delete on public.reservations
  for each row execute function public.decrement_event_attendees();