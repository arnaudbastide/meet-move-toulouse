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
    mutationFn: async ({ slotId, customerEmail }: { slotId: string; customerEmail: string }) => {
      // 1) Create payment intent
      const { stripe, clientSecret, paymentIntentId } = await initiateBooking({
        slotId,
        customerEmail,
      });

      // 2) Create booking via RPC (stores payment intent)
      const bookingId = await bookSlot.mutateAsync({
        slotId,
        paymentIntentId,
      });

      // 3) Attach booking to payment intent transfer group
      const functionsUrl = import.meta.env.VITE_FUNCTIONS_URL;
      const attachResponse = await fetch(`${functionsUrl}/attach-booking-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId, paymentIntentId }),
      });

      if (!attachResponse.ok) {
        const errorData = await attachResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to attach booking transfer');
      }

      // 4) Return client secret and payment intent ID for payment dialog
      return { clientSecret, paymentIntentId };
    },
  });
};
