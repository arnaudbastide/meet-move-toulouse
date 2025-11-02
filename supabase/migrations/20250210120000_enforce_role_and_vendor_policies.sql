-- Enforce immutable roles and vendor event management policies

-- Prevent role changes after insert
drop trigger if exists prevent_role_change_on_profiles on profiles;
create or replace function prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.role_id is distinct from old.role_id then
    raise exception 'ROLE_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger prevent_role_change_on_profiles
before update on profiles
for each row
when (new.role_id is distinct from old.role_id)
execute function prevent_role_change();

drop policy if exists "Vendor update own event" on events;
create policy "Vendor update own event" on events
  for update
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

drop policy if exists "Vendor delete own event" on events;
create policy "Vendor delete own event" on events
  for delete
  using (auth.uid() = vendor_id);

-- Clamp booked places when cancelling
create or replace function cancel_booking(p_booking_id uuid)
returns void as $$
declare
  v_pi text;
  v_slot timestamptz;
begin
  select payment_intent_id, s.start_at into v_pi, v_slot
  from bookings b
    join event_slots s on s.id = b.slot_id
  where b.id = p_booking_id
    and b.user_id = auth.uid();

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_slot < now() + interval '24 hours' then
    raise exception 'CANCELLATION_WINDOW_CLOSED';
  end if;

  update bookings
    set status = 'cancelled'
  where id = p_booking_id;

  update event_slots
    set booked_places = greatest(booked_places - 1, 0)
  where id = (
    select slot_id
    from bookings
    where id = p_booking_id
  );
  -- (Stripe refund will be triggered by webhook)
end;
$$ language plpgsql security definer;
