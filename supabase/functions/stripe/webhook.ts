import type Stripe from 'stripe';
import type { Request, Response } from 'express';
import type { SupabaseServiceClient } from '../lib/supabase.js';
import { logError, logInfo } from '../lib/logger.js';
import type { RequestContext } from '../lib/logger.js';

interface WebhookDependencies {
  stripe: Stripe;
  supabase: SupabaseServiceClient;
  webhookSecret: string;
}

interface VendorAccountRow {
  onboarding_complete: boolean | null;
}

interface BookingRow {
  status: string;
}

async function handleAccountUpdated(
  event: Stripe.Event,
  deps: WebhookDependencies,
  ctx: RequestContext,
): Promise<void> {
  const account = event.data.object as Stripe.Account;
  if (!account.id) {
    return;
  }

  const onboardingComplete = Boolean(account.details_submitted);
  const { error } = await deps.supabase
    .from<VendorAccountRow>('vendor_accounts')
    .update({ onboarding_complete: onboardingComplete })
    .eq('stripe_account_id', account.id)
    .neq('onboarding_complete', onboardingComplete);

  if (error) {
    throw new Error('Failed to update vendor onboarding status');
  }

  logInfo('Stripe account updated', ctx, {
    stripeAccountId: account.id,
    onboardingComplete,
  });
}

async function updateBookingStatus(
  deps: WebhookDependencies,
  paymentIntentId: string,
  status: 'booked' | 'cancelled',
): Promise<void> {
  const { error } = await deps.supabase
    .from<BookingRow>('bookings')
    .update({ status })
    .eq('payment_intent_id', paymentIntentId)
    .neq('status', status);

  if (error) {
    throw new Error('Failed to update booking status');
  }
}

async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  deps: WebhookDependencies,
  ctx: RequestContext,
): Promise<void> {
  const intent = event.data.object as Stripe.PaymentIntent;
  if (!intent.id) {
    return;
  }

  await updateBookingStatus(deps, intent.id, 'booked');
  logInfo('Payment intent succeeded', ctx, { paymentIntentId: intent.id });
}

async function handlePaymentIntentFailed(
  event: Stripe.Event,
  deps: WebhookDependencies,
  ctx: RequestContext,
): Promise<void> {
  const intent = event.data.object as Stripe.PaymentIntent;
  if (!intent.id) {
    return;
  }

  await updateBookingStatus(deps, intent.id, 'cancelled');
  logInfo('Payment intent failed', ctx, { paymentIntentId: intent.id });
}

async function handleChargeRefunded(
  event: Stripe.Event,
  deps: WebhookDependencies,
  ctx: RequestContext,
): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) {
    return;
  }

  await updateBookingStatus(deps, paymentIntentId, 'cancelled');
  logInfo('Charge refunded', ctx, { paymentIntentId });
}

export function createWebhookHandler(deps: WebhookDependencies) {
  return async (req: Request, res: Response): Promise<Response> => {
    const ctx: RequestContext = res.locals.requestContext;
    const signature = req.header('stripe-signature');

    if (!signature) {
      logError('Missing Stripe signature header', ctx);
      return res.status(400).json({ error: 'Missing Stripe signature header' });
    }

    let event: Stripe.Event;
    try {
      event = deps.stripe.webhooks.constructEvent(req.body, signature, deps.webhookSecret);
    } catch (error) {
      logError('Stripe webhook signature verification failed', ctx, {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(400).json({ error: 'Invalid Stripe signature' });
    }

    try {
      switch (event.type) {
        case 'account.updated':
          await handleAccountUpdated(event, deps, ctx);
          break;
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event, deps, ctx);
          break;
        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event, deps, ctx);
          break;
        case 'charge.refunded':
          await handleChargeRefunded(event, deps, ctx);
          break;
        default:
          logInfo('Unhandled Stripe event type', ctx, { eventType: event.type });
      }
    } catch (error) {
      logError('Error handling Stripe webhook', ctx, {
        error: error instanceof Error ? error.message : 'unknown_error',
        eventType: event.type,
      });
      return res.status(500).json({ error: 'Webhook handler failed' });
    }

    return res.json({ received: true });
  };
}
