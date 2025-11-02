import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Event, EventSlot } from '@/lib/types';
import SlotPicker from '@/components/SlotPicker';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useInitiateBooking } from '@/hooks/useInitiateBooking';
import PaymentDialog from '@/components/PaymentDialog';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

const fetchEvent = async (id: string): Promise<Event | null> => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      profiles (
        full_name,
        avatar_url
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Event;
};

const fetchEventSlots = async (eventId: string): Promise<EventSlot[]> => {
  const { data, error } = await supabase
    .from('event_slots')
    .select('*')
    .eq('event_id', eventId)
    .order('start_at');

  if (error) {
    throw new Error(error.message);
  }

  return data as EventSlot[];
};

const EventDetailRoute = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const { mutate: initiateBooking, isPending: isBookingPending } = useInitiateBooking();

  const { data: event, isLoading: isLoadingEvent, error: eventError } = useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEvent(id!),
    enabled: !!id,
  });

  const { data: slots, isLoading: isLoadingSlots, error: slotsError } = useQuery({
    queryKey: ['eventSlots', id],
    queryFn: () => fetchEventSlots(id!),
    enabled: !!id,
  });

  const handleBookSlot = (slotId: string) => {
    if (!user) {
      toast.error('Vous devez être connecté pour réserver.');
      navigate('/auth');
      return;
    }

    if (!event) {
      toast.error('Événement introuvable.');
      return;
    }

    setSelectedSlotId(slotId);
    
    initiateBooking(
      { slotId, customerEmail: user.email! },
      {
        onSuccess: async (result) => {
          // result contains clientSecret and paymentIntentId from the mutation
          if (result?.clientSecret) {
            setClientSecret(result.clientSecret);
            setPaymentDialogOpen(true);
          }
        },
        onError: (error) => {
          toast.error(error.message || 'Erreur lors de l\'initiation de la réservation.');
        },
      }
    );
  };

  const handlePaymentSuccess = () => {
    toast.success('Réservation confirmée !');
    setPaymentDialogOpen(false);
    setClientSecret(null);
    setSelectedSlotId(null);
    navigate('/bookings');
  };

  if (isLoadingEvent || isLoadingSlots) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (eventError || slotsError) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-destructive">Erreur: {eventError?.message || slotsError?.message}</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-muted-foreground">Événement introuvable.</p>
      </div>
    );
  }

  const organizerName = event?.profiles?.full_name ?? event?.organizer_name ?? 'Organisateur communautaire';

  return (
    <>
      <div className="container mx-auto p-4">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <img 
              src="/images/course-canal-du-midi.svg" 
              alt={event.title} 
              className="rounded-md mb-4 w-full h-64 object-cover" 
            />
            <h1 className="text-3xl font-bold">{event.title}</h1>
            <p className="text-muted-foreground my-2">par {organizerName}</p>
            <p className="text-lg mb-4">{event.description}</p>
            <div className="space-y-2 mb-4">
              <p className="font-semibold">Prix: {formatPrice(event.price_cents)}</p>
              <p className="text-muted-foreground">{event.address}</p>
            </div>
          </div>
          <div>
            <SlotPicker 
              slots={slots || []} 
              onSlotSelect={handleBookSlot}
              maxPlaces={event.max_places}
              disabled={isBookingPending}
            />
          </div>
        </div>
      </div>
      <PaymentDialog
        clientSecret={clientSecret}
        open={paymentDialogOpen}
        onClose={() => {
          setPaymentDialogOpen(false);
          setClientSecret(null);
        }}
        onSuccess={handlePaymentSuccess}
        amountLabel={event ? formatPrice(event.price_cents) : undefined}
      />
    </>
  );
};

export default EventDetailRoute;
