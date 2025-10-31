import { useMutation } from '@tanstack/react-query';
import { getFunctionsBaseUrl } from '@/lib/utils';
import { useBookSlot } from './useBookSlot';

interface InitiateBookingVariables {
  slotId: string;
  customerEmail?: string;
}

interface InitiateBookingResult {
  clientSecret: string;
  paymentIntentId: string;
}

const buildFunctionsUrl = (path: string) => `${getFunctionsBaseUrl()}${path}`;

export const useInitiateBooking = () => {
  const bookSlot = useBookSlot();

  return useMutation<InitiateBookingResult, Error, InitiateBookingVariables>({
    mutationKey: ['initiate-booking'],
    mutationFn: async ({ slotId, customerEmail }) => {
      let response: Response;

      try {
        response = await fetch(buildFunctionsUrl('/create-payment-intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slotId, customerEmail }),
        });
      } catch (error) {
        console.error('create-payment-intent network error', error);
        throw new Error('Impossible de contacter le service de paiement.');
      }

      let payload: Partial<InitiateBookingResult> & { error?: string } = {};
      try {
        payload = await response.json();
      } catch (error) {
        console.error('create-payment-intent parse error', error);
      }

      if (!response.ok || !payload.clientSecret || !payload.paymentIntentId) {
        throw new Error(payload.error ?? "La création de l'intention de paiement a échoué.");
      }

      try {
        await bookSlot.mutateAsync({ slotId, paymentIntentId: payload.paymentIntentId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'La réservation a échoué.';
        throw new Error(message);
      }

      return {
        clientSecret: payload.clientSecret,
        paymentIntentId: payload.paymentIntentId,
      } as InitiateBookingResult;
    },
  });
};
