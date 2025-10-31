import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import type { SupabaseServiceClient } from '../../functions/lib/supabase.js';
import { createPaymentIntent, attachBookingTransfer } from '../../functions/stripe/payments.js';

const ctx = { requestId: 'test-request' };

describe('payments handlers', () => {
  it('creates a payment intent with vendor transfer metadata', async () => {
    const stripeMock = {
      paymentIntents: {
        create: vi.fn().mockResolvedValue({
          id: 'pi_123',
          client_secret: 'secret',
          metadata: { slot_id: 'slot-1', event_id: 'event-1' },
        }),
        retrieve: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as Stripe;

    const eventSlotQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'slot-1',
          event_id: 'event-1',
          event: {
            id: 'event-1',
            vendor_id: 'vendor-1',
            price_cents: 4500,
            currency: 'eur',
          },
        },
        error: null,
      }),
    };

    const vendorQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          stripe_account_id: 'acct_123',
        },
        error: null,
      }),
    };

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'event_slots') {
          return eventSlotQuery;
        }
        if (table === 'vendor_accounts') {
          return vendorQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseServiceClient;

    const result = await createPaymentIntent(
      { slotId: 'slot-1', customerEmail: 'user@example.com', idempotencyKey: 'key-123' },
      { stripe: stripeMock, supabase: supabaseMock },
      ctx,
    );

    expect(result).toEqual({ clientSecret: 'secret', paymentIntentId: 'pi_123' });
    expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4500,
        application_fee_amount: 450,
        transfer_data: { destination: 'acct_123' },
        metadata: { slot_id: 'slot-1', event_id: 'event-1' },
      }),
      { idempotencyKey: 'key-123' },
    );
  });

  it('attaches a booking transfer group to the payment intent', async () => {
    const stripeMock = {
      paymentIntents: {
        create: vi.fn(),
        retrieve: vi.fn().mockResolvedValue({
          id: 'pi_123',
          metadata: { slot_id: 'slot-1', event_id: 'event-1' },
        }),
        update: vi.fn().mockResolvedValue({
          id: 'pi_123',
          transfer_group: 'booking-1',
          metadata: { slot_id: 'slot-1', event_id: 'event-1', booking_id: 'booking-1' },
        }),
      },
    } as unknown as Stripe;

    const bookingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'booking-1',
          payment_intent_id: 'pi_123',
          slot_id: 'slot-1',
          event_id: 'event-1',
          status: 'pending',
        },
        error: null,
      }),
    };

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          return bookingQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseServiceClient;

    const result = await attachBookingTransfer(
      { bookingId: 'booking-1', paymentIntentId: 'pi_123' },
      { stripe: stripeMock, supabase: supabaseMock },
      ctx,
    );

    expect(result).toEqual({ transferGroup: 'booking-1' });
    expect(stripeMock.paymentIntents.update).toHaveBeenCalledWith(
      'pi_123',
      expect.objectContaining({
        transfer_group: 'booking-1',
        metadata: { slot_id: 'slot-1', event_id: 'event-1', booking_id: 'booking-1' },
      }),
    );
  });
});
