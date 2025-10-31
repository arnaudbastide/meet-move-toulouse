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
import { formatPrice } from '@/lib/utils';

const EventDetailRoute: React.FC = () => {
  const params = useParams();
  const eventId = params.id;
  const { isUser } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
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
    try {
      const paymentIntentId = self.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      await bookSlot.mutateAsync({ slotId: selectedSlot, paymentIntentId });
      toast.success('Réservation confirmée');
      setSelectedSlot(null);
    } catch (error: any) {
      toast.error(error.message ?? 'Erreur de réservation');
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
            disabled={!isUser || bookSlot.isPending}
            className="w-full"
            data-testid="event-book"
          >
            {bookSlot.isPending ? 'Réservation...' : 'Payer & réserver'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
};

export default EventDetailRoute;
