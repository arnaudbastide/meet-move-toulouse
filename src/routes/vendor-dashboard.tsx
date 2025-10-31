import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Lock, Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatPrice } from '@/lib/utils';
import { supabase, type BookingRecord, type EventRecord, type Profile, type VendorAccount } from '@/lib/supabase';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';

interface BookingWithEvent extends Pick<BookingRecord, 'id' | 'slot_id' | 'status' | 'net_payout_cents' | 'created_at'> {
  event_slots: {
    event_id: string;
    events?: {
      id: string;
      vendor_id: string;
    } | null;
  } | null;
}

const VendorDashboardRoute: React.FC = () => {
  const navigate = useNavigate();
  const { startOnboarding, starting } = useStripeOnboarding();
  const isMountedRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vendorAccount, setVendorAccount] = useState<VendorAccount | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [bookings, setBookings] = useState<BookingWithEvent[]>([]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    setLoading(true);

    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const currentUser = userResult?.user;
      if (!currentUser) {
        toast.error('Connectez-vous en tant que vendor pour accéder au tableau.');
        if (isMountedRef.current) {
          setProfile(null);
          setVendorAccount(null);
          setEvents([]);
          setBookings([]);
        }
        navigate('/auth');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, role_id, created_at')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (profileError) throw profileError;

      if (!profileData || profileData.role_id !== 1) {
        toast.error('Vous devez être vendor pour accéder à ce tableau.');
        if (isMountedRef.current) {
          setProfile(null);
          setVendorAccount(null);
          setEvents([]);
          setBookings([]);
        }
        navigate('/');
        return;
      }

      if (!isMountedRef.current) {
        return;
      }
      setProfile(profileData as Profile);

      const [vendorAccountResponse, eventsResponse, bookingsResponse] = await Promise.all([
        supabase
          .from('vendor_accounts')
          .select('profile_id, stripe_account_id, onboarding_complete, created_at')
          .eq('profile_id', currentUser.id)
          .maybeSingle(),
        supabase
          .from('events')
          .select('id, vendor_id, title, description, category, price_cents, currency, max_places, status, created_at')
          .eq('vendor_id', currentUser.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('id, slot_id, status, net_payout_cents, created_at, event_slots!inner(event_id, events!inner(id, vendor_id))')
          .eq('event_slots.events.vendor_id', currentUser.id),
      ]);

      if (vendorAccountResponse.error) throw vendorAccountResponse.error;
      if (eventsResponse.error) throw eventsResponse.error;
      if (bookingsResponse.error) throw bookingsResponse.error;

      if (!isMountedRef.current) {
        return;
      }

      setVendorAccount((vendorAccountResponse.data ?? null) as VendorAccount | null);
      setEvents((eventsResponse.data ?? []) as EventRecord[]);
      setBookings((bookingsResponse.data ?? []) as BookingWithEvent[]);
    } catch (error) {
      console.error('Failed to load vendor dashboard', error);
      toast.error('Impossible de charger vos données');
      if (!isMountedRef.current) {
        return;
      }
      setVendorAccount(null);
      setEvents([]);
      setBookings([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [navigate]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const onboardingComplete = vendorAccount?.onboarding_complete === true;
  const stripeLocked = !onboardingComplete;

  const { eventsCount, totalBookings, totalRevenueCents } = useMemo(() => {
    const confirmedBookings = bookings.filter((booking) => booking.status === 'booked');
    const revenueCents = confirmedBookings.reduce((acc, booking) => acc + (booking.net_payout_cents ?? 0), 0);
    return {
      eventsCount: events.length,
      totalBookings: confirmedBookings.length,
      totalRevenueCents: revenueCents,
    };
  }, [bookings, events.length]);

  const bookingsByEvent = useMemo(() => {
    const map = new Map<string, { bookings: number; revenueCents: number }>();
    bookings.forEach((booking) => {
      if (booking.status !== 'booked') return;
      const eventId = booking.event_slots?.event_id;
      if (!eventId) return;
      const current = map.get(eventId) ?? { bookings: 0, revenueCents: 0 };
      current.bookings += 1;
      current.revenueCents += booking.net_payout_cents ?? 0;
      map.set(eventId, current);
    });
    return map;
  }, [bookings]);

  const renderSkeleton = () => (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    </main>
  );

  if (loading) {
    return renderSkeleton();
  }

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-12 text-center">
        <p className="text-muted-foreground">
          Connectez-vous en tant que vendor pour accéder au tableau de bord.
        </p>
        <Button className="mt-4" onClick={() => navigate('/auth')}>
          Accéder à la connexion
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bonjour, {profile.name}</h1>
          <p className="text-sm text-muted-foreground">
            Retrouvez ici vos événements, réservations et revenus.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/create">
              <Plus className="mr-2 size-4" /> Créer un événement
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void loadDashboard()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCcw className="mr-2 size-4" />}
            Actualiser
          </Button>
        </div>
      </div>

      <div className="relative mt-8">
        <div className={cn('space-y-6', stripeLocked && 'pointer-events-none opacity-50')}>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Événements publiés</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{eventsCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Réservations totales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{totalBookings}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Revenus totaux</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{formatPrice(totalRevenueCents, 'EUR')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Vos événements</CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <div className="rounded-md border border-dashed border-muted-foreground/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    Créez votre premier événement sur{' '}
                    <Link to="/create" className="font-medium text-primary underline">
                      /create
                    </Link>
                    .
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {events.map((event) => {
                      const stats = bookingsByEvent.get(event.id) ?? { bookings: 0, revenueCents: 0 };
                      return (
                        <li
                          key={event.id}
                          className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {stats.bookings} réservation{stats.bookings > 1 ? 's' : ''} •{' '}
                              {formatPrice(stats.revenueCents, 'EUR')}
                            </p>
                          </div>
                          <Button asChild size="sm" variant="ghost" className="justify-start sm:justify-center">
                            <Link to={`/event/${event.id}`}>Voir la fiche</Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Réservations par semaine</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-muted-foreground/60 text-sm text-muted-foreground">
                  Graphique à venir
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {stripeLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/70 px-6 text-center">
            <div className="rounded-lg bg-background p-6 shadow-lg">
              <div className="flex flex-col items-center gap-3 text-center">
                <Lock className="size-8 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Verrou Stripe — complétez votre compte</h2>
                <p className="text-sm text-muted-foreground">
                  Finalisez votre onboarding Stripe pour débloquer les statistiques et recevoir vos paiements.
                </p>
                <Button
                  className="mt-2"
                  onClick={() => void startOnboarding({ returnPath: '/vendor-dashboard' })}
                  disabled={starting}
                >
                  {starting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Finaliser mon compte Stripe
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default VendorDashboardRoute;
