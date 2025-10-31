import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase, type EventRecord, type EventSlot } from '@/lib/supabase';
import { EventCard } from '@/components/EventCard';
import { SlotPicker } from '@/components/SlotPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useBookSlot } from '@/hooks/useBookSlot';
import PaymentDialog from '@/components/PaymentDialog';
import { formatPrice, getFunctionsBaseUrl } from '@/lib/utils';

const EventDetailRoute: React.FC = () => {
  const params = useParams();
  const eventId = params.id;
  const { isUser, user } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<{ id: string; clientSecret: string } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const bookSlot = useBookSlot();

  const eventQuery = useQuery({
    enabled: !!eventId,
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, vendor:profiles(name, avatar_url)')
        .eq('id', eventId)
        .maybeSingle();
      if (error) throw error;
      return data as (EventRecord & { vendor?: { name?: string | null; avatar_url?: string | null } | null }) | null;
    },
  });

  const slotsQuery = useQuery({
    enabled: !!eventId,
    queryKey: ['event-slots', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_slots')
        .select('*')
        .eq('event_id', eventId)
        .order('start_at');
      if (error) throw error;
      return (data ?? []) as EventSlot[];
    },
  });

  const handleBook = async () => {
    if (!selectedSlot) {
      toast.error('Choisissez un créneau');
      return;
    }
    const baseUrl = getFunctionsBaseUrl();
    if (!baseUrl) {
      toast.error("Configurez VITE_FUNCTIONS_URL pour activer les paiements.");
      return;
    }

    if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
      toast.error('Stripe n\'est pas configuré côté frontend.');
      return;
    }

    try {
      setCreatingIntent(true);
      const response = await fetch(`${baseUrl}/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlot,
          customerEmail: user?.email ?? undefined,
        }),
      });
      const payload = (await response.json()) as {
        clientSecret?: string;
        paymentIntentId?: string;
        error?: string;
      };
      if (!response.ok || !payload.paymentIntentId || !payload.clientSecret) {
        throw new Error(payload.error ?? 'Impossible de créer le paiement.');
      }

      await bookSlot.mutateAsync({ slotId: selectedSlot, paymentIntentId: payload.paymentIntentId });
      toast.info('Créneau réservé. Finalisez le paiement pour confirmer.');
      setPaymentIntent({ id: payload.paymentIntentId, clientSecret: payload.clientSecret });
      setPaymentDialogOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur de réservation';
      toast.error(message);
    } finally {
      setCreatingIntent(false);
    }
  };

  const event = eventQuery.data;
  const slots = useMemo(() => slotsQuery.data ?? [], [slotsQuery.data]);

  if (eventQuery.isLoading) {
    return <p className="p-8 text-center text-muted-foreground">Chargement...</p>;
  }

  if (!event) {
    return <p className="p-8 text-center text-muted-foreground">Événement introuvable.</p>;
  }

  const price = formatPrice(event.price_cents, event.currency ?? 'EUR');

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <EventCard event={{ ...event, vendor_name: event.vendor?.name }} />

      <Card>
        <CardHeader>
          <CardTitle>Réserver un créneau</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">Tarif: {price}</p>
          <SlotPicker slots={slots} selected={selectedSlot ?? undefined} onChange={setSelectedSlot} />
          {!isUser && <p className="text-sm text-muted-foreground">Vous devez être inscrit comme utilisateur pour réserver.</p>}
          <Button
            onClick={handleBook}
            disabled={!isUser || bookSlot.isPending || creatingIntent}
            className="w-full"
            data-testid="event-book"
          >
            {bookSlot.isPending || creatingIntent ? 'Réservation...' : 'Payer & réserver'}
          </Button>
        </CardContent>
      </Card>

      <PaymentDialog
        clientSecret={paymentIntent?.clientSecret ?? null}
        open={paymentDialogOpen}
        onClose={() => {
          setPaymentDialogOpen(false);
          setPaymentIntent(null);
        }}
        onSuccess={() => {
          setPaymentDialogOpen(false);
          setPaymentIntent(null);
          setSelectedSlot(null);
          toast.success('Paiement confirmé, réservation enregistrée.');
        }}
        amountLabel={price}
      />
    </main>
  );
};

export default EventDetailRoute;
