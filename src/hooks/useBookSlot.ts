import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface BookSlotVariables {
  slotId: string;
  paymentIntentId: string;
}

export const useBookSlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['book-slot'],
    mutationFn: async ({ slotId, paymentIntentId }: BookSlotVariables) => {
      const { data, error } = await supabase.rpc('book_slot', {
        p_slot_id: slotId,
        p_payment_intent_id: paymentIntentId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['event-slots'] });
    },
  });
};
