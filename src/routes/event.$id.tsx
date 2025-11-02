import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Event, EventSlot } from '@/lib/types';
import SlotPicker from '@/components/SlotPicker';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useInitiateBooking } from '@/hooks/useInitiateBooking';

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
  const { user } = useAuth();
  const { mutate: initiateBooking, isPending } = useInitiateBooking();

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
    if (user) {
      initiateBooking({ slotId, customerEmail: user.email! });
    } else {
      // Handle case where user is not logged in
      alert('Please login to book a slot.');
    }
  };

  if (isLoadingEvent || isLoadingSlots) {
    return <div>Loading...</div>;
  }

  if (eventError || slotsError) {
    return <div>Error: {eventError?.message || slotsError?.message}</div>;
  }

  if (!event) {
    return <div>Event not found</div>;
  }

  const organizerName = event?.profiles?.full_name ?? event?.organizer_name ?? 'Community host';

  return (
    <div className="container mx-auto p-4">
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <img src="/public/images/course-canal-du-midi.svg" alt={event.title} className="rounded-md mb-4" />
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="text-muted-foreground my-2">by {organizerName}</p>
          <p>{event.description}</p>
        </div>
        <div>
          <SlotPicker slots={slots || []} onSlotSelect={handleBookSlot} />
        </div>
      </div>
    </div>
  );
};

export default EventDetailRoute;
