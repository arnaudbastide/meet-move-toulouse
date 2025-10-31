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
  isDefault?: boolean;
};

const ALL_CATEGORIES = ["Sports", "Language", "Arts", "Food", "Music", "Other"] as const;

const DAYS_FROM_NOW = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

const DEFAULT_EVENTS: Record<(typeof ALL_CATEGORIES)[number], Event> = {
  Sports: {
    id: "default-sports-event",
    title: "Sunrise Fitness Meetup",
    category: "Sports",
    date: DAYS_FROM_NOW(3),
    time: "07:30",
    location: "Prairie des Filtres, Toulouse",
    attendees: 8,
    maxAttendees: 20,
    image: "https://images.unsplash.com/photo-1526403222078-360c85e3b3c7?w=800&h=400&fit=crop",
    description: "Start your morning with a friendly community workout by the Garonne River.",
    organizer: {
      name: "Meet & Move Community",
      initials: "MM",
    },
    isDefault: true,
  },
  Language: {
    id: "default-language-event",
    title: "French & Friends Conversation Night",
    category: "Language",
    date: DAYS_FROM_NOW(5),
    time: "19:00",
    location: "Le Seventies Café, Toulouse",
    attendees: 12,
    maxAttendees: 25,
    image: "https://images.unsplash.com/photo-1503676382389-4809596d5290?w=800&h=400&fit=crop",
    description: "Practice French and meet new people in a relaxed café atmosphere.",
    organizer: {
      name: "Meet & Move Community",
      initials: "MM",
    },
    isDefault: true,
  },
  Arts: {
    id: "default-arts-event",
    title: "Canal du Midi Sketchwalk",
    category: "Arts",
    date: DAYS_FROM_NOW(7),
    time: "15:00",
    location: "Port Saint-Sauveur, Toulouse",
    attendees: 10,
    maxAttendees: 18,
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=400&fit=crop",
    description: "Explore Toulouse's iconic canal while sketching and sharing creative tips.",
    organizer: {
      name: "Meet & Move Community",
      initials: "MM",
    },
    isDefault: true,
  },
  Food: {
    id: "default-food-event",
    title: "Toulouse Tastes Food Crawl",
    category: "Food",
    date: DAYS_FROM_NOW(9),
    time: "18:30",
    location: "Place du Capitole, Toulouse",
    attendees: 16,
    maxAttendees: 24,
    image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&h=400&fit=crop",
    description: "Discover the best regional bites with fellow food lovers.",
    organizer: {
      name: "Meet & Move Community",
      initials: "MM",
    },
    isDefault: true,
  },
  Music: {
    id: "default-music-event",
    title: "Garonne Riverside Jam Session",
    category: "Music",
    date: DAYS_FROM_NOW(11),
    time: "20:00",
    location: "Quai de la Daurade, Toulouse",
    attendees: 14,
    maxAttendees: 30,
    image: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=800&h=400&fit=crop",
    description: "Bring an instrument or just your voice for an open-air music session.",
    organizer: {
      name: "Meet & Move Community",
      initials: "MM",
    },
    isDefault: true,
  },
  Other: {
    id: "default-other-event",
    title: "Hidden Courtyards Photo Walk",
    category: "Other",
    date: DAYS_FROM_NOW(13),
    time: "10:00",
    location: "Rue du Taur, Toulouse",
    attendees: 9,
    maxAttendees: 20,
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&h=400&fit=crop",
    description: "Capture Toulouse's secret spots with local guides and photographers.",
    organizer: {
      name: "Meet & Move Community",
      initials: "MM",
    },
    isDefault: true,
  },
};

const addMissingDefaultEvents = (events: Event[]) => {
  const eventsWithDefaults = [...events];

  ALL_CATEGORIES.forEach((category) => {
    const hasCategory = events.some((event) => event.category === category);
    if (!hasCategory) {
      eventsWithDefaults.push(DEFAULT_EVENTS[category]);
    }
  });

  return eventsWithDefaults;
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
  const { user, profile } = useAuth();

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

      setEvents(addMissingDefaultEvents(mappedEvents));
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents(addMissingDefaultEvents([]));
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

  const ensureProfileExists = useCallback(
    async (fallbackName?: string) => {
      if (!user) return;

      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!existingProfile) {
        const fullName = fallbackName || profile?.full_name || user.email || 'Community Organizer';
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: fullName,
          });

        if (insertError) {
          throw insertError;
        }
      }
    },
    [profile?.full_name, user]
  );

  const addEvent = useCallback(
    async (event: CreateEventInput): Promise<Event | null> => {
      if (!user) return null;

      try {
        await ensureProfileExists(event.organizer?.name);

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

        setEvents((prev) => {
          const filtered = prev.filter(
            (existingEvent) => !(existingEvent.isDefault && existingEvent.category === newEvent.category)
          );
          return [newEvent, ...filtered];
        });
        return newEvent;
      } catch (error) {
        console.error('Error creating event:', error);
        return null;
      }
    },
    [ensureProfileExists, user]
  );

  const reserveSpot = useCallback(
    async (eventId: string): Promise<ReserveSpotResult> => {
      if (!user) {
        return { success: false };
      }

      const existingEvent = events.find((event) => event.id === eventId);

      if (existingEvent?.isDefault) {
        return { success: false, event: existingEvent };
      }

      if (reservedEventIds.includes(eventId)) {
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

      const existingEvent = events.find((event) => event.id === eventId);

      if (existingEvent?.isDefault) {
        return { success: false, event: existingEvent };
      }

      if (!reservedEventIds.includes(eventId)) {
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
