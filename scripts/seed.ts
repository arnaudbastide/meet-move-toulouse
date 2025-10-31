import 'dotenv/config';
import { getServiceClient, type ServiceSupabaseClient } from './utils/supabase-admin.ts';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run the seed script.');
}

const DEMO_VENDOR = {
  email: 'vendor.demo@meet-move.local',
  password: 'ChangeMe123!',
  name: 'Demo Vendor',
  role_id: 1,
};

const DEMO_USER = {
  email: 'user.demo@meet-move.local',
  password: 'ChangeMe123!',
  name: 'Demo User',
  role_id: 2,
};

type SeedSlot = {
  start_at: string;
  end_at: string;
};

type SeedEvent = {
  title: string;
  description: string;
  category: 'sport' | 'culture' | 'food' | 'games' | 'other';
  price_cents: number;
  max_places: number;
  lat: number;
  lng: number;
  address: string;
  slots: SeedSlot[];
};

const SEED_EVENTS: SeedEvent[] = buildSeedEvents();

async function main() {
  const serviceClient = getServiceClient();

  await ensureSeedHelperFunction();

  const vendorUser = await ensureUser(serviceClient, DEMO_VENDOR);
  const demoUser = await ensureUser(serviceClient, DEMO_USER);

  await upsertVendorAccount(serviceClient, vendorUser.id);

  await purgeOldSeedEvents(serviceClient, vendorUser.id);

  const { eventsCreated, slotsCreated } = await insertSeedEvents(serviceClient, vendorUser.id);

  console.table({
    vendorId: vendorUser.id,
    userId: demoUser.id,
    eventsCreated,
    slotsCreated,
  });

  console.info('Seed complete.');
}

main().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});

async function ensureSeedHelperFunction() {
  const sql = `
    create or replace function public.seed_create_event_with_slots(
      p_vendor_id uuid,
      p_title text,
      p_desc text,
      p_cat text,
      p_price_cents int,
      p_max int,
      p_lat float,
      p_lng float,
      p_addr text,
      p_slots jsonb
    ) returns uuid
    language plpgsql
    security definer
    set search_path = public, auth
    as $$
    declare
      v_event_id uuid;
    begin
      perform set_config('request.jwt.claim.sub', p_vendor_id::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform set_config('request.jwt.claim', json_build_object('sub', p_vendor_id::text, 'role', 'authenticated')::text, true);
      v_event_id := create_event_with_slots(p_title, p_desc, p_cat, p_price_cents, p_max, p_lat, p_lng, p_addr, p_slots);
      return v_event_id;
    end;
    $$;
  `;

  const response = await fetch(`${SUPABASE_URL}/postgres/v1/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to ensure seed helper function: ${response.status} ${response.statusText} - ${text}`);
  }

  console.info('Ensured seed helper function.');
}

async function ensureUser(serviceClient: ServiceSupabaseClient, user: typeof DEMO_VENDOR) {
  const existing = await serviceClient.auth.admin.getUserByEmail(user.email);
  if (existing.error) {
    throw existing.error;
  }

  let supabaseUser = existing.data.user;

  if (!supabaseUser) {
    const created = await serviceClient.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (created.error || !created.data.user) {
      throw created.error ?? new Error('Unknown error creating user');
    }

    supabaseUser = created.data.user;
    console.info(`Created auth user ${user.email}`);
  } else {
    console.info(`Auth user ${user.email} already exists`);
  }

  const profilePayload = {
    id: supabaseUser.id,
    name: user.name,
    role_id: user.role_id,
    avatar_url: null,
  };

  const { error: profileError } = await serviceClient.from('profiles').upsert(profilePayload, {
    onConflict: 'id',
  });

  if (profileError) {
    throw profileError;
  }

  return supabaseUser;
}

async function upsertVendorAccount(serviceClient: ServiceSupabaseClient, vendorId: string) {
  const payload = {
    profile_id: vendorId,
    stripe_account_id: 'acct_demo_123',
    onboarding_complete: true,
  };

  const { error } = await serviceClient.from('vendor_accounts').upsert(payload, {
    onConflict: 'profile_id',
  });

  if (error) {
    throw error;
  }

  console.info('Ensured vendor account for demo vendor.');
}

async function purgeOldSeedEvents(serviceClient: ServiceSupabaseClient, vendorId: string) {
  const { data: oldEvents, error } = await serviceClient
    .from('events')
    .select('id')
    .eq('vendor_id', vendorId)
    .like('title', '[SEED]%');

  if (error) {
    throw error;
  }

  if (!oldEvents || oldEvents.length === 0) {
    console.info('No previous seed events to remove.');
    return;
  }

  const eventIds = oldEvents.map((event) => event.id);

  const { error: slotsError } = await serviceClient.from('event_slots').delete().in('event_id', eventIds);
  if (slotsError) {
    throw slotsError;
  }

  const { error: eventsError } = await serviceClient.from('events').delete().in('id', eventIds);
  if (eventsError) {
    throw eventsError;
  }

  console.info(`Removed ${eventIds.length} previous seed events.`);
}

async function insertSeedEvents(serviceClient: ServiceSupabaseClient, vendorId: string) {
  let eventsCreated = 0;
  let slotsCreated = 0;

  for (const event of SEED_EVENTS) {
    const payload = {
      p_vendor_id: vendorId,
      p_title: event.title,
      p_desc: event.description,
      p_cat: event.category,
      p_price_cents: event.price_cents,
      p_max: event.max_places,
      p_lat: event.lat,
      p_lng: event.lng,
      p_addr: event.address,
      p_slots: event.slots,
    } as const;

    const { data, error } = await serviceClient.rpc('seed_create_event_with_slots', payload);

    if (error) {
      throw error;
    }

    eventsCreated += 1;
    slotsCreated += event.slots.length;

    console.info(`Created event ${event.title} (${data}) with ${event.slots.length} slots.`);
  }

  return { eventsCreated, slotsCreated };
}

function buildSeedEvents(): SeedEvent[] {
  const now = new Date();

  const createSlot = (daysFromNow: number, hour: number, durationMinutes: number): SeedSlot => {
    const start = new Date(now.getTime());
    start.setUTCHours(hour, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + daysFromNow);
    if (start.getTime() <= Date.now() + 1000) {
      start.setUTCDate(start.getUTCDate() + 1);
    }
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return {
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    };
  };

  return [
    {
      title: '[SEED] Yoga Sunrise',
      description: 'Session douce au lever du soleil',
      category: 'sport',
      price_cents: 1500,
      max_places: 12,
      lat: 43.6047,
      lng: 1.4442,
      address: 'Toulouse - Prairie des Filtres',
      slots: [createSlot(3, 6, 60), createSlot(5, 6, 60), createSlot(7, 6, 60)],
    },
    {
      title: '[SEED] Balade street-art',
      description: 'Découverte du street-art local',
      category: 'culture',
      price_cents: 1200,
      max_places: 15,
      lat: 43.6,
      lng: 1.45,
      address: 'Toulouse - St-Cyprien',
      slots: [createSlot(4, 14, 90), createSlot(8, 10, 90)],
    },
    {
      title: '[SEED] Atelier tapas',
      description: 'Initiation tapas & convivialité',
      category: 'food',
      price_cents: 2500,
      max_places: 10,
      lat: 43.605,
      lng: 1.442,
      address: 'Toulouse - Carmes',
      slots: [createSlot(6, 18, 120), createSlot(9, 19, 120)],
    },
    {
      title: '[SEED] Tournoi jeux de société',
      description: 'Ambiance chill et stratégie',
      category: 'games',
      price_cents: 900,
      max_places: 20,
      lat: 43.607,
      lng: 1.439,
      address: 'Toulouse - Esquirol',
      slots: [createSlot(5, 17, 150), createSlot(10, 17, 150)],
    },
    {
      title: '[SEED] Rencontre photo',
      description: 'Balade & conseils photo urbains',
      category: 'other',
      price_cents: 0,
      max_places: 25,
      lat: 43.603,
      lng: 1.447,
      address: 'Toulouse - Capitole',
      slots: [createSlot(4, 9, 120), createSlot(11, 16, 120)],
    },
  ];
}
