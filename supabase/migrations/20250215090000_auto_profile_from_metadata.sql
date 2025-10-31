-- Automatically create profiles with role metadata on user signup
set check_function_bodies = off;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_role_id int;
  v_name text;
begin
  v_role := lower(coalesce(new.raw_user_meta_data->>'role', 'user'));
  v_role_id := case v_role when 'vendor' then 1 else 2 end;

  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'name', '')), '');
  if v_name is null then
    v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  end if;
  if v_name is null then
    v_name := new.email;
  end if;

  insert into public.profiles (id, name, role_id)
  values (new.id, v_name, v_role_id)
  on conflict (id) do nothing;

  return new;
exception
  when others then
    -- avoid blocking signups because of profile issues
    raise notice 'profile creation failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

create trigger create_profile_for_new_user
  after insert on auth.users
  for each row
  execute function public.create_profile_for_new_user();
