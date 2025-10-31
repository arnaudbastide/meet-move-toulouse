import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ServiceSupabaseClient = SupabaseClient;

export function getServiceClient(): ServiceSupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing SUPABASE_URL environment variable.');
  }

  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  try {
    return createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (error) {
    throw new Error(`Failed to create Supabase service client: ${String(error)}`);
  }
}
