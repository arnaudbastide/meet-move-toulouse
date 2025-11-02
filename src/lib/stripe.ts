import { loadStripe } from '@stripe/stripe-js';

let stripePromise: ReturnType<typeof loadStripe>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.warn('Stripe publishable key is missing');
    }
    stripePromise = loadStripe(publishableKey ?? '');
  }
  return stripePromise;
};
