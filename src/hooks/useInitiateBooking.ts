import { useMutation } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { useBookSlot } from './useBookSlot';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const initiateBooking = async ({
  slotId,
  customerEmail,
}: {
  slotId: string;
  customerEmail: string;
}) => {
  const functionsUrl = import.meta.env.VITE_FUNCTIONS_URL;
  const response = await fetch(`${functionsUrl}/create-payment-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slotId, customerEmail }),
  });

  if (!response.ok) {
    throw new Error('Failed to create payment intent');
  }

  const { clientSecret, paymentIntentId } = (await response.json()) as {
    clientSecret: string;
    paymentIntentId: string;
  };

  const stripe = await stripePromise;
  if (!stripe) {
    throw new Error('Stripe.js has not loaded yet.');
  }

  return { stripe, clientSecret, paymentIntentId };
};

export const useInitiateBooking = () => {
  const bookSlot = useBookSlot();

  return useMutation({
    mutationFn: initiateBooking,
    onSuccess: async ({ stripe, clientSecret, paymentIntentId }, variables) => {
      // 1) Create booking via RPC
      const bookingId = await bookSlot.mutateAsync({
        slotId: variables.slotId,
        paymentIntentId,
      });

      // 2) Attach booking to payment intent transfer group
      const functionsUrl = import.meta.env.VITE_FUNCTIONS_URL;
      const attachResponse = await fetch(`${functionsUrl}/attach-booking-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId, paymentIntentId }),
      });

      if (!attachResponse.ok) {
        throw new Error('Failed to attach booking transfer');
      }

      // 3) Ready for checkout (handled elsewhere)
      console.info('Payment intent ready', { paymentIntentId, clientSecret });
    },
    onError: (error) => {
      console.error(error);
      alert('Booking failed!');
    },
  });
};
