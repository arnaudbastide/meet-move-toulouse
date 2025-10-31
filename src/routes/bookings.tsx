import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase, type BookingRecord } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatPrice } from '@/lib/utils';

interface BookingWithRelations extends BookingRecord {
  slot?: {
    start_at: string;
    end_at: string;
    event?: {
      title: string;
      address: string;
      price_cents: number;
      currency: string;
    } | null;
  } | null;
}

const BookingsRoute: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({
    enabled: !!user,
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, slot:event_slots(*, event:events(*))')
        .eq('user_id', user?.id ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BookingWithRelations[];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('Réservation annulée');
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Impossible d'annuler";
      toast.error(message);
    },
  });

  if (!user) {
    return <p className="p-8 text-center text-muted-foreground">Connectez-vous pour voir vos réservations.</p>;
  }

  const bookings = bookingsQuery.data ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Mes réservations</h1>
      <div className="space-y-4">
        {bookings.length === 0 && <p className="text-muted-foreground">Aucune réservation pour le moment.</p>}
        {bookings.map((booking) => {
          const event = booking.slot?.event;
          const canCancel = booking.status === 'booked';
          return (
            <Card key={booking.id}>
              <CardHeader>
                <CardTitle>{event?.title ?? 'Événement'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Créneau</span>
                  <span>
                    {booking.slot ? `${formatDateTime(booking.slot.start_at)} → ${formatDateTime(booking.slot.end_at)}` : '---'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Adresse</span>
                  <span>{event?.address}</span>
                </div>
                <div className="flex justify-between">
                  <span>Montant payé</span>
                  <span>{formatPrice(booking.price_cents, event?.currency ?? 'EUR')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="capitalize">Statut: {booking.status}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`booking-cancel-${booking.id}`}
                    disabled={!canCancel || cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(booking.id)}
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
};

export default BookingsRoute;
