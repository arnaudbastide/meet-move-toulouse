import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { slotId, customerEmail } = await req.json();

    if (!slotId || !customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: slotId, customerEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has customer role (role_id = 2)
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role_id !== 2) {
      console.error('Role verification failed:', profileError);
      return new Response(
        JSON.stringify({ error: 'Only customers can create bookings' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get slot details and validate
    const { data: slot, error: slotError } = await supabaseClient
      .from('event_slots')
      .select(`
        id,
        booked_places,
        event:events (
          id,
          price_cents,
          currency,
          max_places,
          vendor_id,
          vendor:vendor_id (
            vendor_account:vendor_accounts (
              stripe_account_id,
              onboarding_complete
            )
          )
        )
      `)
      .eq('id', slotId)
      .single();

    if (slotError || !slot) {
      console.error('Slot not found:', slotError);
      return new Response(
        JSON.stringify({ error: 'Slot not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = slot.event as any;
    const vendorAccount = event.vendor?.[0]?.vendor_account?.[0];

    if (!vendorAccount?.stripe_account_id || !vendorAccount?.onboarding_complete) {
      return new Response(
        JSON.stringify({ error: 'Vendor has not completed Stripe onboarding' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check availability
    if (slot.booked_places >= event.max_places) {
      return new Response(
        JSON.stringify({ error: 'Slot is fully booked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate fees (10% platform fee)
    const priceCents = event.price_cents;
    const platformFeeCents = Math.round(priceCents * 0.10);
    const netPayoutCents = priceCents - platformFeeCents;

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Create Payment Intent with transfer
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceCents,
      currency: event.currency || 'eur',
      receipt_email: customerEmail,
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: vendorAccount.stripe_account_id,
      },
      metadata: {
        slot_id: slotId,
        event_id: event.id,
        user_id: user.id,
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
