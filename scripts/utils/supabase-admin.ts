import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';

export type ServiceSupabaseClient = SupabaseClient;

/**
 * Creates a Supabase client using the service role key for admin operations.
 * This client bypasses Row Level Security (RLS) policies.
 * 
 * @returns ServiceSupabaseClient configured with service role credentials
 * @throws Error if required environment variables are missing
 */
export function getServiceClient(): ServiceSupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing SUPABASE_URL environment variable. Please set it in your .env file.');
  }

  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Please set it in your .env file.');
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

