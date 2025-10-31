-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Roles table
CREATE TABLE roles (
  id INT PRIMARY KEY,
  name TEXT UNIQUE CHECK (name IN ('vendor', 'user'))
);

INSERT INTO roles (id, name) VALUES (1, 'vendor'), (2, 'user');

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT,
  avatar_url TEXT,
  role_id INT NOT NULL REFERENCES roles,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id, role_id)
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('sport', 'culture', 'food', 'games', 'other')),
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  currency TEXT DEFAULT 'eur',
  max_places INT NOT NULL CHECK (max_places > 0),
  geom GEOMETRY(Point, 4326) NOT NULL,
  address TEXT NOT NULL,
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event slots table
CREATE TABLE event_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  booked_places INT DEFAULT 0,
  UNIQUE (event_id, start_at)
);

-- Bookings table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES event_slots ON DELETE CASCADE,
  status TEXT DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'checked_in')),
  price_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,
  net_payout_cents INT NOT NULL,
  payment_intent_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, slot_id)
);

-- Vendor accounts table
CREATE TABLE vendor_accounts (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE NOT NULL,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX ON events (status, created_at, category);
CREATE INDEX ON event_slots (event_id, start_at);
CREATE INDEX ON bookings (user_id, created_at);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone read events" ON events FOR SELECT USING (status = 'published');
CREATE POLICY "Vendor manage own event" ON events FOR ALL USING (auth.uid() = vendor_id);

CREATE POLICY "Anyone read slots" ON event_slots FOR SELECT USING (true);
CREATE POLICY "Vendor manage own slots" ON event_slots FOR ALL USING (auth.uid() = (SELECT vendor_id FROM events WHERE id = event_id));

CREATE POLICY "User read own booking" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User insert booking" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id AND (SELECT role_id FROM profiles WHERE id = auth.uid()) = 2);

CREATE POLICY "Vendor read own account" ON vendor_accounts FOR SELECT USING (auth.uid() = profile_id);

-- Trigger to prevent role change
CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
    RAISE EXCEPTION 'ROLE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_role_change_on_profiles
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_role_change();

-- RPCs
CREATE OR REPLACE FUNCTION create_event_with_slots(
  p_title TEXT, p_desc TEXT, p_cat TEXT, p_price_cents INT, p_max INT,
  p_lat FLOAT, p_lng FLOAT, p_addr TEXT, p_slots JSONB
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO events(vendor_id, title, description, category, price_cents, max_places, geom, address)
  VALUES (auth.uid(), p_title, p_desc, p_cat, p_price_cents, p_max, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), p_addr)
  RETURNING id INTO v_event_id;

  INSERT INTO event_slots(event_id, start_at, end_at)
  SELECT v_event_id, (j->>'start_at')::TIMESTAMPTZ, (j->>'end_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_slots) j;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION book_slot(p_slot_id UUID, p_payment_intent_id TEXT)
RETURNS UUID AS $$
DECLARE
  v_event RECORD;
  v_booking UUID;
  v_platform_fee INT;
  v_net INT;
BEGIN
  SELECT e.price_cents, e.max_places, s.booked_places
  INTO v_event
  FROM event_slots s
  JOIN events e ON e.id = s.event_id
  WHERE s.id = p_slot_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;

  IF v_event.booked_places >= v_event.max_places THEN
    RAISE EXCEPTION 'SLOT_FULL';
  END IF;

  v_platform_fee := CEIL(v_event.price_cents * 0.10);
  v_net := v_event.price_cents - v_platform_fee;

  UPDATE event_slots SET booked_places = booked_places + 1 WHERE id = p_slot_id;

  INSERT INTO bookings(user_id, slot_id, price_cents, platform_fee_cents, net_payout_cents, payment_intent_id)
  VALUES (auth.uid(), p_slot_id, v_event.price_cents, v_platform_fee, v_net, p_payment_intent_id)
  RETURNING id INTO v_booking;

  RETURN v_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id UUID)
RETURNS VOID AS $$
DECLARE
  v_pi TEXT;
  v_slot TIMESTAMPTZ;
BEGIN
  SELECT b.payment_intent_id, s.start_at
  INTO v_pi, v_slot
  FROM bookings b
  JOIN event_slots s ON s.id = b.slot_id
  WHERE b.id = p_booking_id AND b.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF v_slot < NOW() + INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'CANCELLATION_WINDOW_CLOSED';
  END IF;

  UPDATE bookings SET status = 'cancelled' WHERE id = p_booking_id;
  UPDATE event_slots SET booked_places = GREATEST(booked_places - 1, 0) WHERE id = (SELECT slot_id FROM bookings WHERE id = p_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;