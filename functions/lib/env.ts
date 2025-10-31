import { envHint } from './logger.js';

export interface RequiredEnv {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const REQUIRED_KEYS: Array<keyof RequiredEnv> = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

export function assertRequiredEnv(): RequiredEnv {
  const values = Object.fromEntries(
    REQUIRED_KEYS.map((key) => [key, process.env[key]?.trim()])
  ) as Partial<RequiredEnv>;

  const missing = REQUIRED_KEYS.filter((key) => !values[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  envHint();

  return values as RequiredEnv;
}
