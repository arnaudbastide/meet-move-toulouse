-- Admin email allow list for elevated access
create table if not exists public.admin_emails (
  email text primary key
);

-- Helper to check admin status based on JWT email claim
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Ensure RLS is enabled
alter table public.admin_emails enable row level security;

-- Allow admins to view the allow list
create policy "Admins read allow list"
  on public.admin_emails
  for select
  using (public.is_admin());

-- Allow admins to view vendor accounts for oversight
create policy "Admins read vendor accounts"
  on public.vendor_accounts
  for select
  using (public.is_admin());
