import { useMutation } from "@tanstack/react-query";
import { getFunctionsBaseUrl } from "@/lib/utils";
import { useBookSlot } from "./useBookSlot";

type InitiateBookingParams = {
  slotId: string;
  customerEmail: string;
};

type InitiateBookingResult = {
  clientSecret: string;
  paymentIntentId: string;
};

export const useInitiateBooking = () => {
  const bookSlot = useBookSlot();

  return useMutation({
    mutationFn: async ({
      slotId,
      customerEmail,
    }: InitiateBookingParams): Promise<InitiateBookingResult> => {
      const baseUrl = getFunctionsBaseUrl();

      const intentResponse = await fetch(`${baseUrl}/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slotId, customerEmail }),
      });

      if (!intentResponse.ok) {
        const errorData = await intentResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Impossible de créer l'intention de paiement.",
        );
      }

      const {
        clientSecret,
        paymentIntentId,
      } = (await intentResponse.json()) as InitiateBookingResult;

      const bookingId = await bookSlot.mutateAsync({
        slotId,
        paymentIntentId,
      });

      const attachResponse = await fetch(`${baseUrl}/attach-booking-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId, paymentIntentId }),
      });

      if (!attachResponse.ok) {
        const errorData = await attachResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Impossible de lier le transfert Stripe.",
        );
      }

      return { clientSecret, paymentIntentId };
    },
  });
};
