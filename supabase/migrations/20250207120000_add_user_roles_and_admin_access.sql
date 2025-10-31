-- Create role enum for elevated permissions
create type if not exists public.app_role as enum ('admin', 'moderator', 'user');

-- Store user roles separately from profiles
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

-- Function to check roles with elevated privileges
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

-- Ensure row level security is enabled and restricted
alter table public.user_roles enable row level security;

-- Only admins can list roles
create policy "Only admins can view roles"
  on public.user_roles
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Strengthen vendor account protections
create policy "Only admins can view vendor accounts"
  on public.vendor_accounts
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
