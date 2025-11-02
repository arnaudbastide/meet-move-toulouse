import express from 'express';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { z } from 'zod';

const app = express();
const port = process.env.PORT || 8787;

// Middleware
app.use(express.json());

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

// Clients
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
  : null;

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Ensure profile (service role) — upsert profiles(id, full_name, role_id)
const ensureProfileSchema = z.object({
  authUserId: z.string().uuid(),
  name: z.string().min(1),
  role: z.enum(['vendor', 'user']),
});

app.post('/ensure-profile', async (req, res) => {
  try {
    const { authUserId, name, role } = ensureProfileSchema.parse(req.body);
    const roleId = role === 'vendor' ? 1 : 2;
    
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: authUserId,
          full_name: name,
          role_id: roleId,
        },
        { onConflict: 'id' }
      );
      
    if (error) throw error;
    res.json({ ok: true, roleId });
  } catch (error: any) {
    console.error('Error in ensure-profile:', error);
    res.status(400).json({ error: error.message || 'Failed to ensure profile' });
  }
});

// Create Stripe account link
const createAccountLinkSchema = z.object({
  profileId: z.string().uuid(),
  email: z.string().email(),
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
});

app.post('/create-account-link', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const { profileId, email, refreshUrl, returnUrl } = createAccountLinkSchema.parse(req.body);

    let { data: vendorAccount } = await supabase
      .from('vendor_accounts')
      .select('stripe_account_id')
      .eq('profile_id', profileId)
      .single();

    if (!vendorAccount) {
      const account = await stripe.accounts.create({
        type: 'express',
        email,
      });

      const { error } = await supabase.from('vendor_accounts').insert({
        profile_id: profileId,
        stripe_account_id: account.id,
        onboarding_complete: false,
      });

      if (error) throw error;

      vendorAccount = { stripe_account_id: account.id };
    }

    const accountLink = await stripe.accountLinks.create({
      account: vendorAccount.stripe_account_id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (error: any) {
    console.error('Error in create-account-link:', error);
    res.status(400).json({ error: error.message || 'Failed to create account link' });
  }
});

// Create Payment Intent
const createPaymentIntentSchema = z.object({
  slotId: z.string().uuid(),
  customerEmail: z.string().email().optional(),
});

app.post('/create-payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const { slotId, customerEmail } = createPaymentIntentSchema.parse(req.body);

    // 1) Get slot and event info
    const { data: slotRow, error: slotError } = await supabase
      .from('event_slots')
      .select('event_id, booked_places')
      .eq('id', slotId)
      .single();

    if (slotError || !slotRow) {
      throw new Error('Slot not found');
    }

    // 2) Get event pricing and vendor info
    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, price_cents, currency, vendor_id')
      .eq('id', slotRow.event_id)
      .single();

    if (eventError || !eventRow) {
      throw new Error('Event not found');
    }

    // Check if slot is full
    const { data: eventData } = await supabase
      .from('events')
      .select('max_places')
      .eq('id', eventRow.id)
      .single();

    if (eventData && slotRow.booked_places >= eventData.max_places) {
      throw new Error('Slot is full');
    }

    // 3) Get vendor Stripe account
    const { data: vendorAccount, error: vendorError } = await supabase
      .from('vendor_accounts')
      .select('stripe_account_id')
      .eq('profile_id', eventRow.vendor_id)
      .single();

    if (vendorError || !vendorAccount) {
      throw new Error('Vendor account not found');
    }

    // Calculate platform fee (10%)
    const platformFee = Math.ceil(eventRow.price_cents * 0.1);

    // 4) Create payment intent with connected account
    const paymentIntent = await stripe.paymentIntents.create({
      amount: eventRow.price_cents,
      currency: eventRow.currency || 'eur',
      application_fee_amount: platformFee,
      transfer_data: {
        destination: vendorAccount.stripe_account_id,
      },
      metadata: {
        slot_id: slotId,
        event_id: eventRow.id,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Payment intent missing client secret');
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    console.error('Error in create-payment-intent:', error);
    res.status(400).json({ error: error.message || 'Failed to create payment intent' });
  }
});

// Attach booking transfer
const attachBookingTransferSchema = z.object({
  bookingId: z.string().uuid(),
  paymentIntentId: z.string(),
});

app.post('/attach-booking-transfer', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const { bookingId, paymentIntentId } = attachBookingTransferSchema.parse(req.body);

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { booking_id: bookingId },
      transfer_group: bookingId,
    });

    res.json({ transferGroup: bookingId });
  } catch (error: any) {
    console.error('Error in attach-booking-transfer:', error);
    res.status(400).json({ error: error.message || 'Failed to attach booking transfer' });
  }
});

// Stripe Webhook
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    return res.status(500).json({ error: 'Stripe webhook not configured' });
  }

  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await supabase
          .from('vendor_accounts')
          .update({ onboarding_complete: account.details_submitted })
          .eq('stripe_account_id', account.id);
        console.info('Updated vendor account onboarding status');
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        if (paymentIntent.metadata.booking_id) {
          await supabase
            .from('bookings')
            .update({ status: 'booked' })
            .eq('id', paymentIntent.metadata.booking_id);
          console.info('Updated booking status to booked');
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        if (paymentIntent.metadata.booking_id) {
          await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', paymentIntent.metadata.booking_id);
          console.info('Updated booking status to cancelled (payment failed)');
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.metadata.booking_id) {
          await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', charge.metadata.booking_id);
          console.info('Updated booking status to cancelled (refunded)');
        }
        break;
      }
      default:
        console.info(`Unhandled event type: ${event.type}`);
    }
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler failed:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

app.listen(port, () => {
  console.info(`Functions server listening on port ${port}`);
  console.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

