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
  console.info('Starting seed process...');
  const serviceClient = getServiceClient();

  // Create demo users
  const vendorUser = await ensureUser(serviceClient, DEMO_VENDOR);
  const demoUser = await ensureUser(serviceClient, DEMO_USER);

  console.info(`✓ Vendor user: ${vendorUser.email} (${vendorUser.id})`);
  console.info(`✓ User account: ${demoUser.email} (${demoUser.id})`);

  // Upsert vendor account with fake Stripe account (dev only)
  await upsertVendorAccount(serviceClient, vendorUser.id);

  // Purge previous seed events
  await purgeOldSeedEvents(serviceClient, vendorUser.id);

  // Insert seed events
  const { eventsCreated, slotsCreated } = await insertSeedEvents(serviceClient, vendorUser.id);

  console.info('\n=== Seed Summary ===');
  console.table({
    vendorId: vendorUser.id,
    userId: demoUser.id,
    eventsCreated,
    slotsCreated,
  });

  console.info('\n✓ Seed complete!');
  console.info('\nDemo credentials:');
  console.info(`  Vendor: ${DEMO_VENDOR.email} / ${DEMO_VENDOR.password}`);
  console.info(`  User: ${DEMO_USER.email} / ${DEMO_USER.password}`);
}

main().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});



/**
 * Ensures a user exists, creating it if necessary.
 */
async function ensureUser(
  serviceClient: ServiceSupabaseClient,
  user: typeof DEMO_VENDOR,
): Promise<{ id: string; email: string }> {
  // Check if user already exists
  const { data: existingUser, error: lookupError } = await serviceClient.auth.admin.listUsers();
  
  let supabaseUser = existingUser?.users?.find((u) => u.email === user.email);

  if (!supabaseUser) {
    // Create new user
    const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        role: user.role_id === 1 ? 'vendor' : 'user',
        name: user.name,
        full_name: user.name,
      },
    });

    if (createError || !createdUser.user) {
      throw createError ?? new Error('Failed to create user');
    }

    supabaseUser = createdUser.user;
    console.info(`✓ Created auth user: ${user.email}`);
  } else {
    console.info(`✓ Auth user already exists: ${user.email}`);
  }

  // Upsert profile
  const profilePayload = {
    id: supabaseUser.id,
    full_name: user.name,
    role_id: user.role_id,
    avatar_url: null,
  };

  const { error: profileError } = await serviceClient
    .from('profiles')
    .upsert(profilePayload, {
      onConflict: 'id',
    });

  if (profileError) {
    throw profileError;
  }

  return { id: supabaseUser.id, email: supabaseUser.email! };
}

/**
 * Upserts vendor account with fake Stripe account for development.
 */
async function upsertVendorAccount(serviceClient: ServiceSupabaseClient, vendorId: string) {
  const payload = {
    profile_id: vendorId,
    stripe_account_id: 'acct_demo_123',
    onboarding_complete: true,
  };

  const { error } = await serviceClient
    .from('vendor_accounts')
    .upsert(payload, {
      onConflict: 'profile_id',
    });

  if (error) {
    throw error;
  }

  console.info('✓ Ensured vendor account for demo vendor');
}

/**
 * Removes previous seed events (those starting with "[SEED]").
 */
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
    console.info('✓ No previous seed events to remove');
    return;
  }

  const eventIds = oldEvents.map((event) => event.id);

  // Delete slots first (due to foreign key)
  const { error: slotsError } = await serviceClient
    .from('event_slots')
    .delete()
    .in('event_id', eventIds);

  if (slotsError) {
    throw slotsError;
  }

  // Delete events
  const { error: eventsError } = await serviceClient
    .from('events')
    .delete()
    .in('id', eventIds);

  if (eventsError) {
    throw eventsError;
  }

  console.info(`✓ Removed ${eventIds.length} previous seed events`);
}

/**
 * Inserts seed events using the helper function.
 */
async function insertSeedEvents(
  serviceClient: ServiceSupabaseClient,
  vendorId: string,
): Promise<{ eventsCreated: number; slotsCreated: number }> {
  let eventsCreated = 0;
  let slotsCreated = 0;

  for (const event of SEED_EVENTS) {
    // Convert slots to JSONB format
    const slotsJson = event.slots.map((slot) => ({
      start_at: slot.start_at,
      end_at: slot.end_at,
    }));

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
      p_slots: slotsJson,
    };

    try {
      const { data, error } = await serviceClient.rpc('seed_create_event_with_slots', payload);

      if (error) {
        console.error(`Failed to create event ${event.title}:`, error);
        throw error;
      }

      eventsCreated += 1;
      slotsCreated += event.slots.length;

      console.info(`✓ Created event: ${event.title} (${data}) with ${event.slots.length} slots`);
    } catch (error: any) {
      console.error(`Error creating event ${event.title}:`, error.message);
      throw error;
    }
  }

  return { eventsCreated, slotsCreated };
}

/**
 * Builds seed events with future slots.
 */
function buildSeedEvents(): SeedEvent[] {
  const now = new Date();

  const createSlot = (daysFromNow: number, hour: number, durationMinutes: number): SeedSlot => {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() + daysFromNow);
    start.setUTCHours(hour, 0, 0, 0);
    start.setUTCMinutes(0, 0, 0);
    
    // Ensure the slot is in the future
    if (start.getTime() <= Date.now()) {
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
      description: 'Session douce au lever du soleil dans un cadre paisible',
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
      description: 'Découverte du street-art local avec un guide passionné',
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
      description: 'Initiation à la préparation de tapas espagnols en petit groupe',
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
      description: 'Ambiance chill et stratégie pour découvrir de nouveaux jeux',
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
      description: 'Balade urbaine et conseils photo pour débutants et amateurs',
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

