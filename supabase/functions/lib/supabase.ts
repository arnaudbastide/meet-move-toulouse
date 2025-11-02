import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequiredEnv } from './env.js';

export type SupabaseServiceClient = SupabaseClient;

export function createSupabaseServiceClient(env: RequiredEnv): SupabaseServiceClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
