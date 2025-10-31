import type Stripe from 'stripe';
import type { SupabaseServiceClient } from '../lib/supabase.js';
import { internalError } from '../lib/errors.js';
import type { RequestContext } from '../lib/logger.js';
import { logInfo } from '../lib/logger.js';
import type { z } from 'zod';
import { createAccountLinkSchema } from '../lib/validation.js';

export type CreateAccountLinkInput = z.infer<typeof createAccountLinkSchema>;

export interface OnboardingDependencies {
  stripe: Stripe;
  supabase: SupabaseServiceClient;
}

interface VendorAccountRow {
  profile_id: string;
  stripe_account_id: string | null;
  onboarding_complete: boolean | null;
}

export async function createAccountLink(
  input: CreateAccountLinkInput,
  deps: OnboardingDependencies,
  ctx: RequestContext,
): Promise<{ url: string; stripeAccountId: string }> {
  const { profileId, refreshUrl, returnUrl, email } = input;

  const {
    data: vendorAccount,
    error: vendorError,
  } = await deps.supabase
    .from<VendorAccountRow>('vendor_accounts')
    .select('profile_id,stripe_account_id,onboarding_complete')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (vendorError) {
    throw internalError('Unable to retrieve vendor account', 'vendor_account_fetch_failed');
  }

  let stripeAccountId = vendorAccount?.stripe_account_id ?? null;

  if (!stripeAccountId) {
    const account = await deps.stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    stripeAccountId = account.id;

    const { error: upsertError } = await deps.supabase
      .from('vendor_accounts')
      .upsert(
        {
          profile_id: profileId,
          stripe_account_id: stripeAccountId,
          onboarding_complete: account.details_submitted ?? false,
        },
        { onConflict: 'profile_id' },
      );

    if (upsertError) {
      throw internalError('Unable to persist vendor account', 'vendor_account_upsert_failed');
    }

    logInfo('Created Stripe account for vendor', ctx, {
      profileId,
      stripeAccountId,
    });
  }

  const link = await deps.stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return { url: link.url, stripeAccountId };
}
