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

    const { profileId, email, refreshUrl, returnUrl } = await req.json();

    if (!profileId || !email || !refreshUrl || !returnUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: profileId, email, refreshUrl, returnUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is requesting their own profile and has vendor role
    if (profileId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to access this profile' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role_id')
      .eq('id', profileId)
      .single();

    if (profileError || !profile || profile.role_id !== 1) {
      console.error('Vendor verification failed:', profileError);
      return new Response(
        JSON.stringify({ error: 'Only vendors can create Stripe accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Get or create vendor account
    let { data: vendorAccount } = await supabaseClient
      .from('vendor_accounts')
      .select('stripe_account_id')
      .eq('profile_id', profileId)
      .single();

    let stripeAccountId = vendorAccount?.stripe_account_id;

    // Create Stripe account if it doesn't exist
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      stripeAccountId = account.id;

      // Save Stripe account ID
      await supabaseClient
        .from('vendor_accounts')
        .upsert({
          profile_id: profileId,
          stripe_account_id: stripeAccountId,
          onboarding_complete: false,
        });

      console.log('Created Stripe account:', stripeAccountId);
    }

    // Create account link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    console.log('Created account link for:', stripeAccountId);

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating account link:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
