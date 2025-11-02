-- Complete rebuild: Meet & Move production schema
-- Drop existing tables (clean slate)
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS vendor_accounts CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS event_slots CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- Immutable roles table
CREATE TABLE public.roles (
  id integer PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (name IN ('vendor', 'user'))
);

-- Seed roles (immutable)
INSERT INTO public.roles (id, name) VALUES (1, 'vendor'), (2, 'user');

-- Profiles (1:1 with auth.users, role NEVER changes)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_url text,
  role_id integer NOT NULL REFERENCES public.roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, role_id)
);

-- Events (vendors create)
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('sport', 'culture', 'food', 'games', 'other')),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'eur',
  max_places integer NOT NULL CHECK (max_places > 0),
  geom geometry(Point, 4326),
  address text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event slots (time instances of events)
CREATE TABLE public.event_slots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  booked_places integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, start_at)
);

-- Bookings (users book slots)
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  slot_id uuid NOT NULL REFERENCES public.event_slots(id),
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'checked_in')),
  price_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  net_payout_cents integer NOT NULL,
  payment_intent_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slot_id)
);

-- Vendor Stripe accounts
CREATE TABLE public.vendor_accounts (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  stripe_account_id text UNIQUE,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: profiles
CREATE POLICY "Profiles viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies: events
CREATE POLICY "Published events viewable by everyone"
  ON public.events FOR SELECT
  USING (status = 'published');

CREATE POLICY "Vendors can insert own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own events"
  ON public.events FOR DELETE
  USING (auth.uid() = vendor_id);

-- RLS Policies: event_slots
CREATE POLICY "Event slots viewable by everyone"
  ON public.event_slots FOR SELECT
  USING (true);

CREATE POLICY "Vendors can manage own slots"
  ON public.event_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_slots.event_id
      AND events.vendor_id = auth.uid()
    )
  );

-- RLS Policies: bookings
CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role_id = 2
    )
  );

-- RLS Policies: vendor_accounts
CREATE POLICY "Vendors can view own account"
  ON public.vendor_accounts FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Vendors can manage own account"
  ON public.vendor_accounts FOR ALL
  USING (auth.uid() = profile_id);

-- Trigger: prevent role changes (IMMUTABLE)
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
    RAISE EXCEPTION 'Role changes are not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER role_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_change();

-- RPC: create_event_with_slots
CREATE OR REPLACE FUNCTION public.create_event_with_slots(
  p_title text,
  p_description text,
  p_category text,
  p_price_cents integer,
  p_max_places integer,
  p_lat double precision,
  p_lng double precision,
  p_address text,
  p_slots jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_slot jsonb;
BEGIN
  -- Insert event
  INSERT INTO public.events (
    vendor_id, title, description, category,
    price_cents, max_places, geom, address
  ) VALUES (
    auth.uid(), p_title, p_description, p_category,
    p_price_cents, p_max_places,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
    p_address
  ) RETURNING id INTO v_event_id;

  -- Insert slots
  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots)
  LOOP
    INSERT INTO public.event_slots (event_id, start_at, end_at)
    VALUES (
      v_event_id,
      (v_slot->>'start_at')::timestamptz,
      (v_slot->>'end_at')::timestamptz
    );
  END LOOP;

  RETURN v_event_id;
END;
$$;

-- RPC: book_slot
CREATE OR REPLACE FUNCTION public.book_slot(
  p_slot_id uuid,
  p_payment_intent_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
  v_event_id uuid;
  v_price_cents integer;
  v_max_places integer;
  v_booked_places integer;
  v_platform_fee_cents integer;
  v_net_payout_cents integer;
BEGIN
  -- Get event details and check capacity
  SELECT
    e.id, e.price_cents, e.max_places, s.booked_places
  INTO
    v_event_id, v_price_cents, v_max_places, v_booked_places
  FROM public.event_slots s
  JOIN public.events e ON e.id = s.event_id
  WHERE s.id = p_slot_id
  FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;

  IF v_booked_places >= v_max_places THEN
    RAISE EXCEPTION 'Slot is full';
  END IF;

  -- Calculate fees (10% platform fee)
  v_platform_fee_cents := CEIL(v_price_cents * 0.10);
  v_net_payout_cents := v_price_cents - v_platform_fee_cents;

  -- Increment booked places
  UPDATE public.event_slots
  SET booked_places = booked_places + 1
  WHERE id = p_slot_id;

  -- Create booking
  INSERT INTO public.bookings (
    user_id, slot_id, price_cents,
    platform_fee_cents, net_payout_cents,
    payment_intent_id
  ) VALUES (
    auth.uid(), p_slot_id, v_price_cents,
    v_platform_fee_cents, v_net_payout_cents,
    p_payment_intent_id
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- RPC: cancel_booking
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_id uuid;
  v_created_at timestamptz;
BEGIN
  -- Get booking details
  SELECT slot_id, created_at
  INTO v_slot_id, v_created_at
  FROM public.bookings
  WHERE id = p_booking_id
  AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Check 24h cancellation window
  IF now() - v_created_at > interval '24 hours' THEN
    RAISE EXCEPTION 'Cancellation window expired (24h)';
  END IF;

  -- Update booking status
  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE id = p_booking_id;

  -- Decrement booked places
  UPDATE public.event_slots
  SET booked_places = GREATEST(booked_places - 1, 0)
  WHERE id = v_slot_id;

  RETURN true;
END;
$$;

-- Indexes for performance
CREATE INDEX idx_events_status_created ON public.events(status, created_at);
CREATE INDEX idx_events_category ON public.events(category);
CREATE INDEX idx_event_slots_event_start ON public.event_slots(event_id, start_at);
CREATE INDEX idx_bookings_user_created ON public.bookings(user_id, created_at);
CREATE INDEX idx_bookings_slot ON public.bookings(slot_id);
CREATE INDEX idx_events_geom ON public.events USING GIST(geom);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role_id')::integer, 2)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();