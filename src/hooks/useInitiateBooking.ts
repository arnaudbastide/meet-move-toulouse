import { useMutation } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const initiateBooking = async ({ slotId, customerEmail }: { slotId: string; customerEmail: string; }) => {
  const functionsUrl = import.meta.env.VITE_FUNCTIONS_URL;
  const res = await fetch(`${functionsUrl}/create-payment-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slotId, customerEmail }),
  });

  if (!res.ok) {
    throw new Error('Failed to create payment intent');
  }

  const { clientSecret, paymentIntentId } = await res.json();

  const stripe = await stripePromise;
  if (!stripe) {
    throw new Error('Stripe.js has not loaded yet.');
  }

  return { stripe, clientSecret, paymentIntentId };
};

export const useInitiateBooking = () => {
  return useMutation({
    mutationFn: initiateBooking,
    onSuccess: async ({ stripe, clientSecret, paymentIntentId }) => {
      // Here you would typically redirect to a checkout page
      // or use stripe.confirmCardPayment(clientSecret, ...)
      console.log('Payment intent created:', paymentIntentId);
      alert('Redirecting to payment...');
    },
    onError: (error) => {
      console.error(error);
      alert('Booking failed!');
    },
  });
};