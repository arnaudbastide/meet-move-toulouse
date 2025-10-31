import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, type EventRecord } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EventCard } from '@/components/EventCard';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';
import { useVendorAccount } from '@/hooks/useVendorAccount';
import { Skeleton } from '@/components/ui/skeleton';

interface EventWithStats extends EventRecord {
  slots?: { id: string; start_at: string; booked_places: number }[] | null;
  bookings?: { id: string; status: string; price_cents: number; net_payout_cents: number }[] | null;
}

const VendorDashboardRoute: React.FC = () => {
  const { user } = useAuth();
  const { account, isLoading: accountLoading } = useVendorAccount();
  const { startOnboarding, starting } = useStripeOnboarding();

  const eventsQuery = useQuery({
    enabled: !!user,
    queryKey: ['vendor-events', user?.id],
    queryFn: async () => {
      const eventsResponse = await supabase
        .from('events')
        .select('*, slots:event_slots(*), bookings:bookings(*)')
        .eq('vendor_id', user?.id ?? '')
        .order('created_at', { ascending: false });

      if (eventsResponse.error) throw eventsResponse.error;

      return {
        events: (eventsResponse.data ?? []) as EventWithStats[],
      };
    },
  });

  useEffect(() => {
    if (eventsQuery.error) {
      toast.error('Impossible de charger vos événements pour le moment.');
    }
  }, [eventsQuery.error]);

  if (!user) {
    return <p className="p-8 text-center text-muted-foreground">Connectez-vous en tant que vendor pour accéder au tableau.</p>;
  }

  const events = eventsQuery.data?.events ?? [];
  const isFetchingEvents = eventsQuery.isLoading;
  const onboardingToastId = useRef<string | number | null>(null);

  useEffect(() => {
    if (starting && !onboardingToastId.current) {
      onboardingToastId.current = toast.loading('Redirection vers Stripe...');
    }

    if (!starting && onboardingToastId.current) {
      toast.dismiss(onboardingToastId.current);
      onboardingToastId.current = null;
    }
  }, [starting]);

  const onboardingComplete = Boolean(account?.onboarding_complete);
  const shouldRestrictContent = accountLoading || !onboardingComplete;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tableau de bord vendor</h1>
          <p className="text-sm text-muted-foreground">
            Suivez vos événements et vos revenus nets depuis cet espace.
          </p>
        </div>
        {!onboardingComplete && (
          <Button
            onClick={() => {
              void startOnboarding({ returnPath: '/vendor-dashboard' });
            }}
            disabled={starting || accountLoading}
          >
            {(starting || accountLoading) && <Loader2 className="size-4 animate-spin" />}
            {accountLoading
              ? 'Chargement du compte Stripe...'
              : starting
                ? 'Connexion à Stripe...'
                : 'Finaliser mon compte Stripe'}
          </Button>
        )}
      </div>

      <div
        className={`grid gap-4 sm:grid-cols-2 ${shouldRestrictContent ? 'opacity-60' : ''}`}
        aria-disabled={shouldRestrictContent}
      >
        <Card>
          <CardHeader>
            <CardTitle>Total réservations</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isFetchingEvents || shouldRestrictContent ? '—' : totals.totalBookings}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenus nets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isFetchingEvents || shouldRestrictContent ? '—' : formatPrice(totals.totalRevenue, 'EUR')}
          </CardContent>
        </Card>
      </div>

      {!accountLoading && !onboardingComplete && (
        <p className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-4 text-sm text-muted-foreground">
          Finalisez votre onboarding Stripe pour débloquer la création et les statistiques de vos événements.
        </p>
      )}

      <div className="space-y-4">
        {isFetchingEvents && (
          <>
            {Array.from({ length: 2 }).map((_, index) => (
              <Card key={index} className="space-y-4">
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-40 w-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
        {!isFetchingEvents &&
          events.map((event) => {
          const totalBookedPlaces = event.slots?.reduce((sum, slot) => sum + (slot.booked_places ?? 0), 0) ?? 0;
          const eventRevenue = formatPrice(
            event.bookings?.reduce(
              (sum, booking) => (booking.status === 'booked' ? sum + booking.net_payout_cents : sum),
              0,
            ) ?? 0,
          );

          return (
            <Card
              key={event.id}
              className={shouldRestrictContent ? 'pointer-events-none opacity-60' : undefined}
              aria-disabled={shouldRestrictContent}
            >
              <CardHeader>
                <CardTitle>{event.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EventCard event={{ ...event, vendor_name: undefined }} variant="dashboard" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Créneaux publiés</span>
                    <span>{shouldRestrictContent ? '—' : event.slots?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Places réservées</span>
                    <span>{shouldRestrictContent ? '—' : `${totalBookedPlaces} / ${event.max_places}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Revenu net</span>
                    <span>{shouldRestrictContent ? '—' : eventRevenue}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isFetchingEvents && events.length === 0 && (
          <p className="text-muted-foreground">
            {accountLoading
              ? 'Chargement des informations Stripe...'
              : onboardingComplete
                ? 'Créez votre premier événement pour voir les statistiques.'
                : 'Terminez votre onboarding Stripe pour commencer à publier vos événements.'}
          </p>
        )}
      </div>
    </main>
  );
};

export default VendorDashboardRoute;
