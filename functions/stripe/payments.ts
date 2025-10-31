import type Stripe from 'stripe';
import type { SupabaseServiceClient } from '../lib/supabase.js';
import { badRequest, conflict, internalError, notFound } from '../lib/errors.js';
import type { RequestContext } from '../lib/logger.js';
import { logInfo } from '../lib/logger.js';
import type { z } from 'zod';
import { attachBookingTransferSchema, createPaymentIntentSchema } from '../lib/validation.js';

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema> & {
  idempotencyKey?: string;
};

export type AttachBookingTransferInput = z.infer<typeof attachBookingTransferSchema>;

export interface PaymentsDependencies {
  stripe: Stripe;
  supabase: SupabaseServiceClient;
}

interface EventSlotRow {
  id: string;
  event_id: string;
  event: {
    id: string;
    vendor_id: string;
    price_cents: number;
    currency: string | null;
  } | null;
}

interface VendorAccountRow {
  stripe_account_id: string | null;
}

interface BookingRow {
  id: string;
  payment_intent_id: string | null;
  slot_id: string | null;
  event_id: string | null;
  status: string;
}

export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
  deps: PaymentsDependencies,
  ctx: RequestContext,
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const { slotId, customerEmail, idempotencyKey } = input;

  const {
    data: slot,
    error: slotError,
  } = await deps.supabase
    .from<EventSlotRow>('event_slots')
    .select('id,event_id,event:events(id,vendor_id,price_cents,currency)')
    .eq('id', slotId)
    .maybeSingle();

  if (slotError) {
    throw internalError('Unable to load event slot', 'slot_fetch_failed');
  }

  if (!slot || !slot.event) {
    throw notFound('Slot not found', 'slot_not_found');
  }

  const amount = Number(slot.event.price_cents);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw internalError('Invalid event price configuration', 'invalid_price');
  }

  const currency = (slot.event.currency ?? 'eur').toLowerCase();

  const {
    data: vendorAccount,
    error: vendorError,
  } = await deps.supabase
    .from<VendorAccountRow>('vendor_accounts')
    .select('stripe_account_id')
    .eq('profile_id', slot.event.vendor_id)
    .maybeSingle();

  if (vendorError) {
    throw internalError('Unable to load vendor account', 'vendor_account_fetch_failed');
  }

  if (!vendorAccount?.stripe_account_id) {
    throw badRequest('Vendor Stripe account missing', 'vendor_missing_stripe_account');
  }

  const platformFee = Math.ceil(amount * 0.1);

  const paymentIntent = await deps.stripe.paymentIntents.create(
    {
      amount,
      currency,
      receipt_email: customerEmail,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFee,
      transfer_data: {
        destination: vendorAccount.stripe_account_id,
      },
      metadata: {
        slot_id: slot.id,
        event_id: slot.event.id,
      },
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  if (!paymentIntent.client_secret) {
    throw internalError('Stripe payment intent is missing client secret', 'payment_intent_missing_client_secret');
  }

  logInfo('Created payment intent', ctx, {
    slotId,
    paymentIntentId: paymentIntent.id,
    vendorStripeAccount: vendorAccount.stripe_account_id,
  });

  return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
}

export async function attachBookingTransfer(
  input: AttachBookingTransferInput,
  deps: PaymentsDependencies,
  ctx: RequestContext,
): Promise<{ transferGroup: string }> {
  const { paymentIntentId, bookingId } = input;

  const {
    data: booking,
    error: bookingError,
  } = await deps.supabase
    .from<BookingRow>('bookings')
    .select('id,payment_intent_id,slot_id,event_id,status')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    throw internalError('Unable to load booking', 'booking_fetch_failed');
  }

  if (!booking) {
    throw notFound('Booking not found', 'booking_not_found');
  }

  if (!booking.payment_intent_id) {
    throw conflict('Booking has no payment intent to attach', 'booking_missing_payment_intent');
  }

  if (booking.payment_intent_id !== paymentIntentId) {
    throw badRequest('Payment intent mismatch for booking', 'payment_intent_mismatch');
  }

  const intent = await deps.stripe.paymentIntents.retrieve(paymentIntentId);

  const metadata: Record<string, string> = { ...intent.metadata };
  if (!metadata.slot_id && booking.slot_id) {
    metadata.slot_id = booking.slot_id;
  }
  if (!metadata.event_id && booking.event_id) {
    metadata.event_id = booking.event_id;
  }

  if (!metadata.slot_id || !metadata.event_id) {
    throw internalError('Payment intent metadata missing slot or event identifiers', 'payment_intent_metadata_invalid');
  }

  metadata.booking_id = bookingId;

  const updated = await deps.stripe.paymentIntents.update(paymentIntentId, {
    transfer_group: bookingId,
    metadata,
  });

  logInfo('Attached booking to payment intent', ctx, {
    bookingId,
    paymentIntentId: updated.id,
  });

  return { transferGroup: updated.transfer_group ?? bookingId };
}
