import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, type EventRecord } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EventCard } from '@/components/EventCard';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';

interface EventWithStats extends EventRecord {
  slots?: { id: string; start_at: string; booked_places: number }[] | null;
  bookings?: { id: string; status: string; price_cents: number; net_payout_cents: number }[] | null;
}

interface VendorAccount {
  profile_id: string;
  onboarding_complete: boolean;
  stripe_account_id: string;
}

const VendorDashboardRoute: React.FC = () => {
  const { user } = useAuth();
  const { account, isLoading: accountLoading } = useVendorAccount();
  const { startOnboarding, starting } = useStripeOnboarding();

  const eventsQuery = useQuery({
    enabled: !!user,
    queryKey: ['vendor-events', user?.id],
    queryFn: async () => {
      const [eventsResponse, vendorAccountResponse] = await Promise.all([
        supabase
          .from('events')
          .select('*, slots:event_slots(*), bookings:bookings(*)')
          .eq('vendor_id', user?.id ?? '')
          .order('created_at', { ascending: false }),
        supabase
          .from('vendor_accounts')
          .select('*')
          .eq('profile_id', user!.id)
          .maybeSingle(),
      ]);

      if (eventsResponse.error) throw eventsResponse.error;
      if (vendorAccountResponse.error) throw vendorAccountResponse.error;

      return {
        events: (eventsResponse.data ?? []) as EventWithStats[],
        vendorAccount: (vendorAccountResponse.data ?? null) as VendorAccount | null,
      };
    },
  });

  if (!user) {
    return <p className="p-8 text-center text-muted-foreground">Connectez-vous en tant que vendor pour accéder au tableau.</p>;
  }

  const events = eventsQuery.data?.events ?? [];
  const vendorAccount = eventsQuery.data?.vendorAccount ?? null;
  const onboardingComplete = vendorAccount?.onboarding_complete ?? false;

  const { startOnboarding, starting } = useStripeOnboarding();
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

  const hasAccount = Boolean(account?.stripe_account_id);
  const onboardingComplete = Boolean(account?.onboarding_complete);
  const onboardingStatusLabel = accountLoading
    ? 'Chargement'
    : onboardingComplete
      ? 'Terminé'
      : hasAccount
        ? 'En attente'
        : 'À démarrer';
  const onboardingStatusVariant = accountLoading
    ? 'outline'
    : onboardingComplete
      ? 'default'
      : hasAccount
        ? 'secondary'
        : 'destructive';

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
            disabled={starting}
          >
            {starting && <Loader2 className="size-4 animate-spin" />}
            {starting ? 'Connexion à Stripe...' : 'Finaliser mon compte Stripe'}
          </Button>
        )}
      </div>

      <div
        className={`grid gap-4 sm:grid-cols-2 ${onboardingComplete ? '' : 'opacity-60'}`}
        aria-disabled={!onboardingComplete}
      >
        <Card>
          <CardHeader>
            <CardTitle>Total réservations</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {onboardingComplete ? totals.totalBookings : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenus nets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {onboardingComplete ? formatPrice(totals.totalRevenue, 'EUR') : '—'}
          </CardContent>
        </Card>
      </div>

      {!onboardingComplete && (
        <p className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-4 text-sm text-muted-foreground">
          Finalisez votre onboarding Stripe pour débloquer la création et les statistiques de vos événements.
        </p>
      )}

      <div className="space-y-4">
        {events.map((event) => {
          const totalBookedPlaces = event.slots?.reduce((sum, slot) => sum + (slot.booked_places ?? 0), 0) ?? 0;
          const eventRevenue = formatPrice(
            event.bookings?.reduce(
              (sum, booking) => (booking.status === 'booked' ? sum + booking.net_payout_cents : sum),
              0,
            ) ?? 0,
          );

          return (
            <Card key={event.id} className={!onboardingComplete ? 'opacity-60' : undefined} aria-disabled={!onboardingComplete}>
              <CardHeader>
                <CardTitle>{event.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <EventCard event={{ ...event, vendor_name: undefined }} variant="dashboard" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Créneaux publiés</span>
                    <span>{onboardingComplete ? event.slots?.length ?? 0 : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Places réservées</span>
                    <span>{onboardingComplete ? `${totalBookedPlaces} / ${event.max_places}` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Revenu net</span>
                    <span>{onboardingComplete ? eventRevenue : '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {events.length === 0 && (
          <p className="text-muted-foreground">
            {onboardingComplete
              ? 'Créez votre premier événement pour voir les statistiques.'
              : 'Terminez votre onboarding Stripe pour commencer à publier vos événements.'}
          </p>
        )}
      </div>
    </main>
  );
};

export default VendorDashboardRoute;
