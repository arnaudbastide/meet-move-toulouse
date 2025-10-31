import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type Event = {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  attendees: number;
  maxAttendees: number;
  image?: string;
  description?: string;
  organizer?: {
    name: string;
    initials: string;
  };
  createdAt?: string;
  organizerId?: string;
};

export type CreateEventInput = Omit<Event, "id" | "attendees" | "createdAt" | "organizerId"> & { 
  id?: string;
  attendees?: number;
  createdAt?: string;
};

type ReserveSpotResult = {
  success: boolean;
  event?: Event;
};

type CancelReservationResult = {
  success: boolean;
  event?: Event;
};

type EventsContextValue = {
  events: Event[];
  addEvent: (event: CreateEventInput) => Promise<Event | null>;
  reserveSpot: (eventId: string) => Promise<ReserveSpotResult>;
  cancelReservation: (eventId: string) => Promise<CancelReservationResult>;
  reservedEventIds: string[];
  reservedEvents: Event[];
  isEventReserved: (eventId: string) => boolean;
  isLoading: boolean;
};

const EventsContext = createContext<EventsContextValue | undefined>(undefined);

export const EventsProvider = ({ children }: { children: React.ReactNode }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [reservedEventIds, setReservedEventIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Fetch events from database
  useEffect(() => {
    fetchEvents();
  }, []);

  // Fetch user's reservations
  useEffect(() => {
    if (user) {
      fetchReservations();
    } else {
      setReservedEventIds([]);
    }
  }, [user]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedEvents: Event[] = (data || []).map((event) => ({
        id: event.id,
        title: event.title,
        category: event.category,
        date: event.date,
        time: event.time,
        location: event.location,
        attendees: event.attendees,
        maxAttendees: event.max_attendees,
        image: event.image_url || undefined,
        description: event.description || undefined,
        organizer: {
          name: event.organizer_name,
          initials: event.organizer_initials,
        },
        createdAt: event.created_at,
        organizerId: event.organizer_id,
      }));

      setEvents(mappedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReservations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('event_id')
        .eq('user_id', user.id);

      if (error) throw error;

      setReservedEventIds(data?.map((r) => r.event_id) || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    }
  };

  const addEvent = useCallback(async (event: CreateEventInput): Promise<Event | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: event.title,
          description: event.description || '',
          category: event.category,
          date: event.date,
          time: event.time,
          location: event.location,
          max_attendees: event.maxAttendees,
          image_url: event.image || null,
          organizer_id: user.id,
          organizer_name: event.organizer?.name || 'Community Organizer',
          organizer_initials: event.organizer?.initials || 'CO',
        })
        .select()
        .single();

      if (error) throw error;

      const newEvent: Event = {
        id: data.id,
        title: data.title,
        category: data.category,
        date: data.date,
        time: data.time,
        location: data.location,
        attendees: data.attendees,
        maxAttendees: data.max_attendees,
        image: data.image_url || undefined,
        description: data.description || undefined,
        organizer: {
          name: data.organizer_name,
          initials: data.organizer_initials,
        },
        createdAt: data.created_at,
        organizerId: data.organizer_id,
      };

      setEvents((prev) => [newEvent, ...prev]);
      return newEvent;
    } catch (error) {
      console.error('Error creating event:', error);
      return null;
    }
  }, [user]);

  const reserveSpot = useCallback(
    async (eventId: string): Promise<ReserveSpotResult> => {
      if (!user) {
        return { success: false };
      }

      if (reservedEventIds.includes(eventId)) {
        const existingEvent = events.find((event) => event.id === eventId);
        return { success: false, event: existingEvent };
      }

      try {
        const { error } = await supabase
          .from('reservations')
          .insert({
            user_id: user.id,
            event_id: eventId,
          });

        if (error) throw error;

        // Fetch updated event
        await fetchEvents();
        setReservedEventIds((prev) => [...prev, eventId]);

        const updatedEvent = events.find((e) => e.id === eventId);
        return { success: true, event: updatedEvent };
      } catch (error: any) {
        console.error('Error reserving spot:', error);
        return { success: false };
      }
    },
    [user, events, reservedEventIds]
  );

  const cancelReservation = useCallback(
    async (eventId: string): Promise<CancelReservationResult> => {
      if (!user) {
        return { success: false };
      }

      if (!reservedEventIds.includes(eventId)) {
        const existingEvent = events.find((event) => event.id === eventId);
        return { success: false, event: existingEvent };
      }

      try {
        const { error } = await supabase
          .from('reservations')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', eventId);

        if (error) throw error;

        // Fetch updated event
        await fetchEvents();
        setReservedEventIds((prev) => prev.filter((id) => id !== eventId));

        const updatedEvent = events.find((e) => e.id === eventId);
        return { success: true, event: updatedEvent };
      } catch (error) {
        console.error('Error canceling reservation:', error);
        return { success: false };
      }
    },
    [user, events, reservedEventIds]
  );

  const isEventReserved = useCallback(
    (eventId: string) => reservedEventIds.includes(eventId),
    [reservedEventIds]
  );

  const reservedEvents = useMemo(
    () => events.filter((event) => reservedEventIds.includes(event.id)),
    [events, reservedEventIds]
  );

  const value = useMemo(
    () => ({
      events,
      addEvent,
      reserveSpot,
      cancelReservation,
      reservedEventIds,
      reservedEvents,
      isEventReserved,
      isLoading,
    }),
    [events, addEvent, reserveSpot, cancelReservation, reservedEventIds, reservedEvents, isEventReserved, isLoading]
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
};

export const useEvents = () => {
  const context = useContext(EventsContext);

  if (!context) {
    throw new Error("useEvents must be used within an EventsProvider");
  }

  return context;
};
