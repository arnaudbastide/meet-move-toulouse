create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  date date not null,
  time time not null,
  location text not null,
  max_attendees integer not null check (max_attendees > 0),
  attendees_count integer not null default 0 check (attendees_count >= 0),
  image_url text,
  organizer_id uuid not null references auth.users (id) on delete cascade,
  organizer_name text not null,
  organizer_initials text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_events_updated_at
  before update on public.events
  for each row
  execute procedure public.handle_updated_at();

alter table public.events enable row level security;

create policy "Allow public read access to events"
  on public.events
  for select
  using (true);

create policy "Allow authenticated users to create events"
  on public.events
  for insert
  to authenticated
  with check (auth.uid() = organizer_id);
