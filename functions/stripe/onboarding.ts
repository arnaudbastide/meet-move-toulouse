import type Stripe from 'npm:stripe@17';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { internalError, validationError } from '../lib/errors.ts';
import type { RequestContext } from '../lib/logger.ts';
import { logInfo } from '../lib/logger.ts';
import { createAccountLinkSchema } from '../lib/validation.ts';

export interface OnboardingDependencies {
  stripe: Stripe;
  supabase: SupabaseClient;
}

export async function createAccountLink(
  input: unknown,
  deps: OnboardingDependencies,
  ctx: RequestContext
): Promise<{ url: string; stripeAccountId: string }> {
  const validated = createAccountLinkSchema.safeParse(input);
  if (!validated.success) {
    throw validationError('Invalid input', validated.error.errors);
  }

  const { profileId, refreshUrl, returnUrl, email } = validated.data;

  // Verify caller owns this profile
  if (ctx.userId !== profileId) {
    throw validationError('Unauthorized', []);
  }

  // Check if vendor (role_id = 1)
  const { data: profile, error: profileError } = await deps.supabase
    .from('profiles')
    .select('id, role_id')
    .eq('id', profileId)
    .single();

  if (profileError || !profile) {
    throw validationError('Profile not found', []);
  }

  if (profile.role_id !== 1) {
    throw validationError('Only vendors can onboard', []);
  }

  // Get or create vendor account
  const { data: vendorAccount } = await deps.supabase
    .from('vendor_accounts')
    .select('stripe_account_id')
    .eq('profile_id', profileId)
    .maybeSingle();

  let stripeAccountId = vendorAccount?.stripe_account_id;

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
        { onConflict: 'profile_id' }
      );

    if (upsertError) {
      throw internalError('Failed to create vendor account', 'vendor_account_upsert_failed');
    }

    logInfo('Created Stripe account for vendor', ctx, { profileId, stripeAccountId });
  }

  const link = await deps.stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return { url: link.url, stripeAccountId };
}
