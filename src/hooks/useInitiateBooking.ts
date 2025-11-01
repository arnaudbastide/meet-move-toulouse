import { useMutation } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '@/lib/supabase';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL ?? 'http://localhost:8787';

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : Promise.resolve(null);

const initiateBooking = async ({
  slotId,
  customerEmail,
}: {
  slotId: string;
  customerEmail: string;
}) => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    throw new Error('Missing Stripe publishable key');
  }

  const paymentIntentResponse = await fetch(`${FUNCTIONS_URL}/create-payment-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slotId, customerEmail }),
  });

  if (!paymentIntentResponse.ok) {
    throw new Error('Failed to create payment intent');
  }

  const { clientSecret, paymentIntentId } = (await paymentIntentResponse.json()) as {
    clientSecret: string;
    paymentIntentId: string;
  };

  const { data: bookingId, error: bookingError } = await supabase.rpc('book_slot', {
    p_slot_id: slotId,
    p_payment_intent_id: paymentIntentId,
  });

  if (bookingError || !bookingId) {
    throw new Error(bookingError?.message ?? 'Failed to reserve the slot');
  }

  const attachResponse = await fetch(`${FUNCTIONS_URL}/attach-booking-transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bookingId,
      paymentIntentId,
    }),
  });

  if (!attachResponse.ok) {
    throw new Error('Failed to attach booking transfer');
  }

  const stripe = await stripePromise;
  if (!stripe) {
    throw new Error('Stripe.js has not loaded yet.');
  }

  return {
    stripe,
    clientSecret,
    paymentIntentId,
    bookingId,
  };
};

export const useInitiateBooking = () => {
  return useMutation({
    mutationFn: initiateBooking,
    onSuccess: async ({ stripe, clientSecret, bookingId }) => {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: 'pm_card_visa',
      });

      if (error) {
        console.error(error);
        alert(error.message ?? 'Payment confirmation failed.');
        return;
      }

      alert('Booking confirmed!');
      window.location.href = '/bookings';
    },
    onError: (error: unknown) => {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Booking failed!';
      alert(message);
    },
  });
};
