import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, type EventRecord } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EventCard } from '@/components/EventCard';
import { formatPrice } from '@/lib/utils';

interface EventWithStats extends EventRecord {
  slots?: { id: string; start_at: string; booked_places: number }[] | null;
  bookings?: { id: string; status: string; price_cents: number; net_payout_cents: number }[] | null;
}

const VendorDashboardRoute: React.FC = () => {
  const { user } = useAuth();

  const eventsQuery = useQuery({
    enabled: !!user,
    queryKey: ['vendor-events', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, slots:event_slots(*), bookings:bookings(*)')
        .eq('vendor_id', user?.id ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventWithStats[];
    },
  });

  if (!user) {
    return <p className="p-8 text-center text-muted-foreground">Connectez-vous en tant que vendor pour accéder au tableau.</p>;
  }

  const events = eventsQuery.data ?? [];

  const totals = useMemo(() => {
    const totalBookings = events.reduce((acc, event) => acc + (event.bookings?.length ?? 0), 0);
    const totalRevenue = events.reduce(
      (acc, event) =>
        acc +
        (event.bookings?.reduce((sum, booking) => (booking.status === 'booked' ? sum + booking.net_payout_cents : sum), 0) ?? 0),
      0,
    );
    return { totalBookings, totalRevenue };
  }, [events]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total réservations</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.totalBookings}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenus nets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatPrice(totals.totalRevenue, 'EUR')}</CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle>{event.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EventCard event={{ ...event, vendor_name: undefined }} variant="dashboard" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Créneaux publiés</span>
                  <span>{event.slots?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Places réservées</span>
                  <span>
                    {event.slots?.reduce((sum, slot) => sum + (slot.booked_places ?? 0), 0) ?? 0} / {event.max_places}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Revenue net</span>
                  <span>
                    {formatPrice(
                      event.bookings?.reduce(
                        (sum, booking) => (booking.status === 'booked' ? sum + booking.net_payout_cents : sum),
                        0,
                      ) ?? 0,
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {events.length === 0 && <p className="text-muted-foreground">Créez votre premier événement pour voir les statistiques.</p>}
      </div>
    </main>
  );
};

export default VendorDashboardRoute;
