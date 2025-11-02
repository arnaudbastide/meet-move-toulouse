import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Booking } from '@/lib/types';
import { formatPrice, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BookingWithDetails extends Booking {
  event_slots: {
    id: string;
    start_at: string;
    end_at: string;
    event_id: string;
    events: {
      id: string;
      title: string;
      description: string;
      address: string;
      price_cents: number;
    };
  };
}

const fetchUserBookings = async (userId: string): Promise<BookingWithDetails[]> => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      event_slots!inner (
        id,
        start_at,
        end_at,
        event_id,
        events!inner (
          id,
          title,
          description,
          address,
          price_cents
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown) as BookingWithDetails[];
};

const cancelBooking = async (bookingId: string): Promise<void> => {
  const { error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
  });

  if (error) {
    throw new Error(error.message || 'Erreur lors de l\'annulation');
  }
};

const BookingsRoute = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['bookings', user?.id],
    queryFn: () => fetchUserBookings(user!.id),
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      toast.success('Réservation annulée avec succès.');
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['event-slots'] });
    },
    onError: (error: Error) => {
      const message = error.message;
      if (message.includes('CANCELLATION_WINDOW_CLOSED')) {
        toast.error('Impossible d\'annuler: la fenêtre d\'annulation est fermée (moins de 24h avant le créneau).');
      } else if (message.includes('BOOKING_NOT_FOUND')) {
        toast.error('Réservation introuvable.');
      } else {
        toast.error(message || 'Erreur lors de l\'annulation de la réservation.');
      }
    },
  });

  const canCancel = (slotStartAt: string): boolean => {
    const slotDate = new Date(slotStartAt);
    const now = new Date();
    const hoursUntilSlot = (slotDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilSlot > 24;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'booked':
        return <Badge variant="default">Confirmée</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Annulée</Badge>;
      case 'checked_in':
        return <Badge variant="outline">Sur place</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-destructive">Erreur: {error.message}</p>
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">Mes réservations</h1>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>Aucune réservation pour le moment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-3xl font-bold mb-4">Mes réservations</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bookings.map((booking) => {
          const slot = booking.event_slots;
          const event = slot.events;
          const slotStart = new Date(slot.start_at);
          const canCancelThis = booking.status === 'booked' && canCancel(slot.start_at);

          return (
            <Card key={booking.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  {getStatusBadge(booking.status)}
                </div>
                <CardDescription className="line-clamp-2">{event.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <p className="font-semibold">
                    {format(slotStart, 'PPpp', { locale: fr })}
                  </p>
                  <p className="text-muted-foreground">
                    jusqu'à {format(new Date(slot.end_at), 'HH:mm', { locale: fr })}
                  </p>
                  <p className="text-muted-foreground">{event.address}</p>
                </div>
                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prix:</span>
                    <span className="font-semibold">{formatPrice(booking.price_cents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frais de plateforme:</span>
                    <span>{formatPrice(booking.platform_fee_cents)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t pt-1">
                    <span>Total payé:</span>
                    <span>{formatPrice(booking.price_cents)}</span>
                  </div>
                </div>
                {canCancelThis && (
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate(booking.id)}
                    disabled={cancelMutation.isPending}
                    className="w-full"
                  >
                    {cancelMutation.isPending ? 'Annulation...' : 'Annuler la réservation'}
                  </Button>
                )}
                {!canCancelThis && booking.status === 'booked' && (
                  <p className="text-sm text-muted-foreground text-center">
                    Annulation possible jusqu'à 24h avant le créneau.
                  </p>
                )}
                <div className="text-xs text-muted-foreground">
                  Réservée le {formatDateTime(booking.created_at)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BookingsRoute;
