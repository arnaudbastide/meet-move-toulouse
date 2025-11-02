import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { VendorEventWithStats, VendorDashboardTotals } from '@/lib/types';

const fetchVendorTotals = async (vendorId: string): Promise<VendorDashboardTotals> => {
  // Get event IDs for this vendor
  const { data: vendorEvents, error: eventsError } = await supabase
    .from('events')
    .select('id')
    .eq('vendor_id', vendorId);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const eventIds = vendorEvents?.map(e => e.id) ?? [];
  const eventsCount = eventIds.length;

  if (eventIds.length === 0) {
    return {
      bookingsCount: 0,
      totalRevenue: 0,
      eventsCount: 0,
    };
  }

  // Get slots for these events
  const { data: slots, error: slotsError } = await supabase
    .from('event_slots')
    .select('id')
    .in('event_id', eventIds);

  if (slotsError) {
    throw new Error(slotsError.message);
  }

  const slotIds = slots?.map(s => s.id) ?? [];

  // Get bookings for these slots
  const { data: bookingsData, error: bookingsErr } = await supabase
    .from('bookings')
    .select('net_payout_cents')
    .eq('status', 'booked')
    .in('slot_id', slotIds);

  if (bookingsErr) {
    throw new Error(bookingsErr.message);
  }

  const bookingsCount = bookingsData?.length ?? 0;
  const totalRevenue = bookingsData?.reduce((sum, b) => sum + (b.net_payout_cents ?? 0), 0) ?? 0;

  return {
    bookingsCount,
    totalRevenue,
    eventsCount,
  };
};

const fetchVendorEventsWithStats = async (vendorId: string): Promise<VendorEventWithStats[]> => {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const eventsWithStats = await Promise.all(
    (events || []).map(async (event) => {
      // Get slots count
      const { data: slots, error: slotsError } = await supabase
        .from('event_slots')
        .select('id')
        .eq('event_id', event.id);

      const slots_count = slots?.length ?? 0;

      // Get revenue for this event
      const { data: bookingsData, error: bookingsErr } = await supabase
        .from('bookings')
        .select('net_payout_cents, slot_id, event_slots!inner(event_id)')
        .eq('status', 'booked')
        .eq('event_slots.event_id', event.id);

      const revenue = bookingsData?.reduce((sum, b) => sum + (b.net_payout_cents ?? 0), 0) ?? 0;

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        price_cents: event.price_cents,
        address: event.address,
        created_at: event.created_at,
        slots_count,
        revenue,
      };
    })
  );

  return eventsWithStats;
};

const fetchVendorAccount = async (profileId: string) => {
  const { data, error } = await supabase
    .from('vendor_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  return data;
};

const VendorDashboardRoute = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { mutate: initiateOnboarding, isPending: isOnboardingPending } = useStripeOnboarding();

  const { data: totals, isLoading: isLoadingTotals } = useQuery({
    queryKey: ['vendorTotals', user?.id],
    queryFn: () => fetchVendorTotals(user!.id),
    enabled: !!user,
  });

  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['vendorEventsWithStats', user?.id],
    queryFn: () => fetchVendorEventsWithStats(user!.id),
    enabled: !!user,
  });

  const { data: vendorAccount, isLoading: isLoadingAccount } = useQuery({
    queryKey: ['vendorAccount', user?.id],
    queryFn: () => fetchVendorAccount(user!.id),
    enabled: !!user,
  });

  const isOnboardingComplete = vendorAccount?.onboarding_complete ?? false;
  const isLocked = !isOnboardingComplete;

  const handleOnboarding = () => {
    if (user && profile) {
      initiateOnboarding({
        profileId: profile.id,
        email: user.email!,
        refreshUrl: window.location.href,
        returnUrl: window.location.href,
      });
    }
  };

  // Soft route guard: show friendly message if not vendor
  if (!authLoading && (!profile || profile.role_id !== 1)) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Accès restreint</CardTitle>
            <CardDescription>
              Cette page est réservée aux vendeurs. Devenez vendeur pour accéder au tableau de bord.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full">
              <Link to="/auth">Devenir vendeur</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingTotals || isLoadingEvents || isLoadingAccount) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Tableau de bord</h1>

      {/* Onboarding Section */}
      {!isOnboardingComplete && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle>Finalisez votre compte Stripe</CardTitle>
            <CardDescription>
              Pour recevoir vos paiements, vous devez finaliser la configuration de votre compte Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleOnboarding} disabled={isOnboardingPending}>
              {isOnboardingPending ? 'Redirection...' : 'Finaliser mon compte Stripe'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Totals Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={isLocked ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Réservations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals?.bookingsCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card className={isLocked ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenu total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totals?.totalRevenue ?? 0)}</div>
          </CardContent>
        </Card>
        <Card className={isLocked ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Événements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals?.eventsCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Mes événements</h2>
        {isLoadingEvents ? (
          <p className="text-muted-foreground">Chargement...</p>
        ) : !events || events.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <p>Aucun événement créé pour le moment.</p>
              <Button asChild className="mt-4">
                <Link to="/create">Créer un événement</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <Card key={event.id} className={isLocked ? 'opacity-50' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <Badge variant="secondary">{event.category}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{event.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <p>{event.address}</p>
                    <p className="mt-1">{formatPrice(event.price_cents)}</p>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">
                      {event.slots_count} créneau{event.slots_count > 1 ? 'x' : ''}
                    </span>
                    <span className="font-semibold">
                      {formatPrice(event.revenue)} de revenu
                    </span>
                  </div>
                  <Button asChild variant="outline" className="w-full mt-4">
                    <Link to={`/event/${event.id}`}>Voir détails</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorDashboardRoute;
