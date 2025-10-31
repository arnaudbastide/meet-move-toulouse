import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 8787;

const stripeSecret = process.env.STRIPE_SECRET_KEY ?? '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const supabaseUrl = process.env.SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!stripeSecret || !supabaseUrl || !serviceKey) {
  console.warn('Stripe or Supabase environment variables are missing.');
}

const stripe = new Stripe(stripeSecret, { apiVersion: '2024-11-20' });
const supabase = createClient(supabaseUrl, serviceKey);

app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    return next();
  }
  return express.json()(req, res, next);
});

app.post('/create-account-link', async (req, res) => {
  try {
    const { profileId, refreshUrl, returnUrl } = req.body as {
      profileId: string;
      refreshUrl: string;
      returnUrl: string;
    };

    if (!profileId) {
      return res.status(400).json({ error: 'Missing profileId' });
    }

    const { data: vendorAccount } = await supabase
      .from('vendor_accounts')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();

    let stripeAccountId = vendorAccount?.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: req.body.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;
      await supabase.from('vendor_accounts').upsert({
        profile_id: profileId,
        stripe_account_id: stripeAccountId,
        onboarding_complete: account.details_submitted ?? false,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (error: any) {
    console.error('create-account-link error', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { slotId, customerEmail } = req.body as { slotId: string; customerEmail?: string };
    if (!slotId) {
      return res.status(400).json({ error: 'Missing slotId' });
    }

    const { data, error } = await supabase
      .from('event_slots')
      .select('id, event:events(id, vendor_id, price_cents, currency)')
      .eq('id', slotId)
      .maybeSingle();
    if (error || !data?.event) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    const { data: vendorAccount } = await supabase
      .from('vendor_accounts')
      .select('*')
      .eq('profile_id', data.event.vendor_id)
      .maybeSingle();

    if (!vendorAccount?.stripe_account_id) {
      return res.status(400).json({ error: 'Vendor has no Stripe account' });
    }

    const platformFee = Math.ceil((data.event.price_cents ?? 0) * 0.1);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: data.event.price_cents,
      currency: data.event.currency ?? 'eur',
      receipt_email: customerEmail,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFee,
      transfer_data: {
        destination: vendorAccount.stripe_account_id,
      },
      metadata: {
        slot_id: data.id,
        event_id: data.event.id,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (error: any) {
    console.error('create-payment-intent error', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature ?? '', webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (account.id) {
          await supabase
            .from('vendor_accounts')
            .update({ onboarding_complete: account.details_submitted ?? false })
            .eq('stripe_account_id', account.id);
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.id) {
          await supabase
            .from('bookings')
            .update({ status: 'booked' })
            .eq('payment_intent_id', intent.id);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.id) {
          await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('payment_intent_id', intent.id);
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (typeof charge.payment_intent === 'string') {
          await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('payment_intent_id', charge.payment_intent);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('Webhook handling error', error);
    return res.status(500).send('Webhook handler failed');
  }

  res.json({ received: true });
});

const isDirectRun = (() => {
  const current = fileURLToPath(import.meta.url);
  const executed = process.argv[1];
  return executed ? current === executed : false;
})();

if (isDirectRun) {
  app.listen(port, () => {
    console.log(`Stripe functions listening on port ${port}`);
  });
}

export default app;
