import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, type EventRecord } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EventCard } from '@/components/EventCard';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useVendorAccount } from '@/hooks/useVendorAccount';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';

interface EventWithStats extends EventRecord {
  slots?: { id: string; start_at: string; booked_places: number }[] | null;
  bookings?: { id: string; status: string; price_cents: number; net_payout_cents: number }[] | null;
}

const VendorDashboardRoute: React.FC = () => {
  const { user } = useAuth();
  const {
    account: vendorAccount,
    isLoading: accountLoading,
    isRefetching: isRefreshingAccount,
    refetch: refetchAccount,
  } = useVendorAccount();
  const { startOnboarding, starting } = useStripeOnboarding();

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

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const onboardingComplete = vendorAccount?.onboarding_complete ?? false;
  const stripeAccountId = vendorAccount?.stripe_account_id;

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

  if (!user) {
    return <p className="p-8 text-center text-muted-foreground">Connectez-vous en tant que vendor pour accéder au tableau.</p>;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <section className="w-full">
        {accountLoading ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Vérification du statut Stripe...
            </CardContent>
          </Card>
        ) : onboardingComplete ? (
          <Card className="border-green-500/40 bg-green-500/5">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <CardTitle className="text-base font-semibold">Stripe activé</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <p>
                Votre compte Stripe Express est connecté
                {stripeAccountId ? ` (${stripeAccountId})` : ''}. Les paiements seront transférés automatiquement.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void refetchAccount();
                  }}
                  disabled={isRefreshingAccount}
                >
                  {isRefreshingAccount ? 'Vérification…' : 'Rafraîchir le statut'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => startOnboarding()} disabled={starting}>
                  {starting ? 'Ouverture…' : 'Mettre à jour mes infos Stripe'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Activez Stripe pour encaisser vos réservations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Complétez l’onboarding Stripe Express pour recevoir les paiements des utilisateurs. Vous pourrez ensuite
                publier des expériences et être payé automatiquement.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => startOnboarding()} disabled={starting}>
                  {starting ? 'Redirection…' : 'Commencer l’onboarding Stripe'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void refetchAccount();
                  }}
                  disabled={isRefreshingAccount}
                >
                  {isRefreshingAccount ? 'Vérification…' : 'J’ai déjà terminé'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

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
        {events.length === 0 && (
          <p className="text-muted-foreground">Créez votre premier événement pour voir les statistiques.</p>
        )}
      </div>
    </main>
  );
};

export default VendorDashboardRoute;
