import express from 'express';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { z } from 'zod';

const app = express();
const port = process.env.PORT || 8787;

// Middleware
app.use(express.json());

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Clients
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

const ensureProfileSchema = z.object({
  role: z.enum(['vendor', 'user', 'admin']),
  name: z.string().min(1).optional(),
});

app.post('/ensure-profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }

    const accessToken = authHeader.slice('Bearer '.length);
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !userResult?.user) {
      res.status(401).json({ error: 'Invalid access token' });
      return;
    }

    const payload = ensureProfileSchema.parse(req.body);
    const roleId = payload.role === 'vendor' ? 1 : payload.role === 'admin' ? 99 : 2;
    const displayName =
      payload.name?.trim() ||
      (userResult.user.email?.split('@')[0] ?? 'Community member');

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userResult.user.id,
          role_id: roleId,
          name: displayName,
          full_name: displayName,
          avatar_url: (userResult.user.user_metadata?.avatar_url as string | null | undefined) ?? null,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    res.json({ profile: data });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to ensure profile' });
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
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create account link' });
  }
});

// Create Payment Intent
const createPaymentIntentSchema = z.object({
  slotId: z.string().uuid(),
  customerEmail: z.string().email().optional(),
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { slotId, customerEmail } = createPaymentIntentSchema.parse(req.body);

    const { data: slot, error: slotError } = await supabase
      .from('event_slots')
      .select('id, event_id, start_at, end_at, booked_places')
      .eq('id', slotId)
      .single();

    if (slotError || !slot) {
      throw new Error('Slot not found');
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', slot.event_id)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    const { data: vendorAccount, error: vendorError } = await supabase
      .from('vendor_accounts')
      .select('stripe_account_id')
      .eq('profile_id', event.vendor_id)
      .single();

    if (vendorError || !vendorAccount) {
      throw new Error('Vendor account not found');
    }

    const platformFee = Math.ceil(event.price_cents * 0.1);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: event.price_cents,
      currency: event.currency || 'eur',
      application_fee_amount: platformFee,
      transfer_data: {
        destination: vendorAccount.stripe_account_id,
      },
      metadata: {
        slot_id: slotId,
        event_id: event.id,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create payment intent' });
  }
});

// Attach booking transfer
const attachBookingTransferSchema = z.object({
  bookingId: z.string().uuid(),
  paymentIntentId: z.string(),
});

app.post('/attach-booking-transfer', async (req, res) => {
  try {
    const { bookingId, paymentIntentId } = attachBookingTransferSchema.parse(req.body);

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { booking_id: bookingId },
      transfer_group: bookingId,
    });

    res.json({ transferGroup: bookingId });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to attach booking transfer' });
  }
});

// Stripe Webhook
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await supabase
          .from('vendor_accounts')
          .update({ onboarding_complete: account.details_submitted })
          .eq('stripe_account_id', account.id);
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        if (paymentIntent.metadata.booking_id) {
          await supabase
            .from('bookings')
            .update({ status: 'booked' })
            .eq('id', paymentIntent.metadata.booking_id);
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
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

app.listen(port, () => {
  console.log(`Functions server listening on port ${port}`);
});
