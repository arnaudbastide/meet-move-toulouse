import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const missingSupabaseConfig = !supabaseUrl || !supabaseAnonKey;

if (missingSupabaseConfig) {
  console.warn(
    'Supabase environment variables are missing. The client will be disabled until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided.',
  );
}

const createDisabledSupabaseClient = (): SupabaseClient => {
  const error = new Error(
    'Supabase client is disabled because VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured.',
  );

  const handler: ProxyHandler<Record<string, unknown>> = {
    get() {
      throw error;
    },
    apply() {
      throw error;
    },
  };

  return new Proxy({}, handler) as SupabaseClient;
};

const createSupabaseClient = (): SupabaseClient => {
  if (missingSupabaseConfig) {
    return createDisabledSupabaseClient();
  }

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
};

export const supabase = createSupabaseClient();

export type ProfileRole = 'vendor' | 'user';

export interface Profile {
  id: string;
  name: string;
  avatar_url?: string | null;
  role_id: number;
  created_at: string;
}

export interface EventSlot {
  id: string;
  event_id: string;
  start_at: string;
  end_at: string;
  booked_places: number;
}

export interface EventRecord {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  category: 'sport' | 'culture' | 'food' | 'games' | 'other' | null;
  image_url?: string | null;
  price_cents: number;
  currency: string;
  max_places: number;
  geom: { type: 'Point'; coordinates: [number, number] } | string | null;
  address: string;
  status: 'published' | 'cancelled';
  created_at: string;
}

export interface BookingRecord {
  id: string;
  user_id: string;
  slot_id: string;
  status: 'booked' | 'cancelled' | 'checked_in';
  price_cents: number;
  platform_fee_cents: number;
  net_payout_cents: number;
  payment_intent_id: string | null;
  transfer_group: string | null;
  created_at: string;
}

export type VendorAccount = {
  profile_id: string;
  stripe_account_id: string | null;
  onboarding_complete: boolean | null;
  created_at: string;
};
