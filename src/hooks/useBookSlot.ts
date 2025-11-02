import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BookSlotParams {
  slotId: string;
  paymentIntentId: string;
}

/**
 * Hook to book a slot via the book_slot RPC.
 * Creates a booking record in the database with the payment intent ID.
 */
export const useBookSlot = () => {
  return useMutation({
    mutationFn: async ({ slotId, paymentIntentId }: BookSlotParams): Promise<string> => {
      const { data, error } = await supabase.rpc('book_slot', {
        p_slot_id: slotId,
        p_payment_intent_id: paymentIntentId,
      });

      if (error) {
        throw new Error(error.message || 'Failed to book slot');
      }

      if (!data || typeof data !== 'string') {
        throw new Error('Invalid booking ID returned from RPC');
      }

      return data as string;
    },
  });
};

