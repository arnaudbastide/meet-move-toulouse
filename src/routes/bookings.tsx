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

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

const getCancellationErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const rawMessage = typeof (error as { message?: unknown }).message === 'string' ? error.message : null;
    if (rawMessage) {
      if (rawMessage.includes('CANCELLATION_WINDOW_CLOSED')) {
        return "La fenêtre d’annulation (24h) est dépassée.";
      }
      if (rawMessage.includes('BOOKING_NOT_FOUND')) {
        return 'Réservation introuvable ou déjà annulée.';
      }
    }
  }

  return "Impossible d’annuler la réservation pour le moment.";
};

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

  const cancelMutation = useMutation<void, Error, CancelBookingVariables>({
    mutationFn: async ({ bookingId }: CancelBookingVariables) => {
      const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId });
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      toast.success('Réservation annulée');
      const invalidations = [queryClient.invalidateQueries({ queryKey: ['bookings'] })];

      if (variables?.eventId) {
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] }));
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['event-slots', variables.eventId] }));
      } else {
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['event'] }));
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['event-slots'] }));
      }

      invalidations.push(queryClient.invalidateQueries({ queryKey: ['vendor-events'] }));

      await Promise.all(invalidations);
    },
    onError: (error: any) => {
      toast.error(getCancellationErrorMessage(error));
    },
  });

  if (!user) {
    return <p className="p-8 text-center text-muted-foreground">Connectez-vous pour voir vos réservations.</p>;
  }

  if (bookingsQuery.isLoading) {
    return <p className="p-8 text-center text-muted-foreground">Chargement de vos réservations...</p>;
  }

  if (bookingsQuery.error) {
    return (
      <p className="p-8 text-center text-destructive">
        Impossible de charger vos réservations. Réessayez plus tard.
      </p>
    );
  }

  const bookings = bookingsQuery.data ?? [];
  const now = Date.now();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Mes réservations</h1>
      <div className="space-y-4">
        {bookings.length === 0 && <p className="text-muted-foreground">Aucune réservation pour le moment.</p>}
        {bookings.map((booking) => {
          const event = booking.slot?.event;
          const slotStart = booking.slot?.start_at ? new Date(booking.slot.start_at) : null;
          const cancellationWindowPassed = slotStart ? slotStart.getTime() - now < CANCEL_WINDOW_MS : false;
          const canCancel = booking.status === 'booked' && !cancellationWindowPassed;
          const isCancellingThisBooking = cancelMutation.isPending && cancelMutation.variables === booking.id;
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
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="capitalize">Statut: {booking.status}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`booking-cancel-${booking.id}`}
                      disabled={!canCancel || cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(booking.id)}
                    >
                      {isCancellingThisBooking ? 'Annulation...' : 'Annuler'}
                    </Button>
                  </div>
                  {booking.status === 'booked' && (
                    <p className="text-xs text-muted-foreground">
                      {cancellationWindowPassed
                        ? 'Annulation impossible moins de 24h avant le créneau.'
                        : 'Annulation possible jusqu’à 24h avant le début du créneau.'}
                    </p>
                  )}
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
