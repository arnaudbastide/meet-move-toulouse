import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { supabase, type EventRecord, type EventSlot } from '@/lib/supabase';
import { EventCard } from '@/components/EventCard';
import { SlotPicker } from '@/components/SlotPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useInitiateBooking } from '@/hooks/useInitiateBooking';
import { getStripe } from '@/lib/stripe';
import { formatPrice } from '@/lib/utils';

const EventDetailRoute: React.FC = () => {
  const params = useParams();
  const eventId = params.id;
  const { isUser, user } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<{ clientSecret: string; paymentIntentId: string } | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const initiateBooking = useInitiateBooking();
  const stripePromise = useMemo(() => getStripe(), []);

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
      const { clientSecret, paymentIntentId } = await initiateBooking.mutateAsync({
        slotId: selectedSlot,
        customerEmail: user?.email ?? undefined,
      });
      setPaymentData({ clientSecret, paymentIntentId });
      setIsPaymentDialogOpen(true);
      toast.success('Paiement initié. Finalisez votre réservation.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur de réservation';
      toast.error(message);
    }
  };

  const handlePaymentSuccess = () => {
    toast.success('Réservation confirmée');
    setIsPaymentDialogOpen(false);
    setPaymentData(null);
    setSelectedSlot(null);
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
            disabled={!isUser || initiateBooking.isPending}
            className="w-full"
            data-testid="event-book"
          >
            {initiateBooking.isPending ? 'Réservation...' : 'Payer & réserver'}
          </Button>
        </CardContent>
      </Card>

      {paymentData && (
        <PaymentDialog
          open={isPaymentDialogOpen}
          onOpenChange={(open) => {
            setIsPaymentDialogOpen(open);
            if (!open) {
              setPaymentData(null);
            }
          }}
          clientSecret={paymentData.clientSecret}
          stripePromise={stripePromise}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </main>
  );
};

export default EventDetailRoute;

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string;
  stripePromise: ReturnType<typeof getStripe>;
  onSuccess: () => void;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({ open, onOpenChange, clientSecret, stripePromise, onSuccess }) => {
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: { theme: 'stripe' as const },
    }),
    [clientSecret],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finaliser le paiement</DialogTitle>
          <DialogDescription>Saisissez votre carte bancaire pour confirmer la réservation.</DialogDescription>
        </DialogHeader>
        <Elements stripe={stripePromise} options={options} key={clientSecret}>
          <PaymentForm onSuccess={onSuccess} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
};

interface PaymentFormProps {
  onSuccess: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) {
      toast.error('Chargement de Stripe en cours, veuillez patienter.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/bookings`,
        },
      });

      if (error) {
        toast.error(error.message ?? 'Le paiement a échoué.');
        return;
      }

      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la confirmation du paiement.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" className="w-full" disabled={!stripe || isSubmitting}>
        {isSubmitting ? 'Confirmation...' : 'Confirmer le paiement'}
      </Button>
    </form>
  );
};
