import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
};

export type CreateEventInput = Omit<Event, "id"> & { id?: string };

const DEFAULT_EVENTS: Event[] = [
  {
    id: "1",
    title: "Yoga at Jardin des Plantes",
    category: "Sports",
    date: "2025-11-02",
    time: "18:00",
    location: "Jardin des Plantes, Toulouse",
    attendees: 8,
    maxAttendees: 15,
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=400&fit=crop",
    description:
      "Join us for a relaxing outdoor yoga session in one of Toulouse's most beautiful gardens. All levels welcome! Bring your own mat and water.",
    organizer: {
      name: "Sophie Martin",
      initials: "SM",
    },
    createdAt: "2025-10-15T10:00:00.000Z",
  },
  {
    id: "2",
    title: "French Conversation Meetup",
    category: "Language",
    date: "2025-11-03",
    time: "19:30",
    location: "Café Le Bibent, Toulouse",
    attendees: 12,
    maxAttendees: 20,
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=400&fit=crop",
    description:
      "Practice your French in a relaxed atmosphere with locals and other learners. We'll provide conversation topics and games to keep the chat flowing!",
    organizer: {
      name: "Jean Dupont",
      initials: "JD",
    },
    createdAt: "2025-10-12T15:30:00.000Z",
  },
  {
    id: "3",
    title: "Photography Walk",
    category: "Arts",
    date: "2025-11-04",
    time: "14:00",
    location: "Canal du Midi, Toulouse",
    attendees: 5,
    maxAttendees: 10,
    image: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&h=400&fit=crop",
    description:
      "Capture the scenic spots around Canal du Midi with fellow photography enthusiasts. All camera types welcome, from smartphones to DSLRs.",
    organizer: {
      name: "Lucie Bernard",
      initials: "LB",
    },
    createdAt: "2025-10-10T09:45:00.000Z",
  },
  {
    id: "4",
    title: "Beach Volleyball",
    category: "Sports",
    date: "2025-11-05",
    time: "17:00",
    location: "Toulouse Plage",
    attendees: 16,
    maxAttendees: 20,
    image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&h=400&fit=crop",
    description:
      "Friendly beach volleyball games suitable for all levels. We'll form teams on the spot, so just bring your energy and water!",
    organizer: {
      name: "Camille Rousseau",
      initials: "CR",
    },
    createdAt: "2025-10-08T18:20:00.000Z",
  },
];

const STORAGE_KEY = "meet-move-toulouse:events";

type EventsContextValue = {
  events: Event[];
  addEvent: (event: CreateEventInput) => Event;
};

const EventsContext = createContext<EventsContextValue | undefined>(undefined);

const generateEventId = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}`;
};

const getInitialEvents = (): Event[] => {
  if (typeof window === "undefined") {
    return DEFAULT_EVENTS;
  }

  try {
    const storedEvents = window.localStorage.getItem(STORAGE_KEY);
    if (!storedEvents) {
      return DEFAULT_EVENTS;
    }

    const parsed = JSON.parse(storedEvents) as Event[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (error) {
    console.error("Failed to read events from localStorage", error);
  }

  return DEFAULT_EVENTS;
};

export const EventsProvider = ({ children }: { children: React.ReactNode }) => {
  const [events, setEvents] = useState<Event[]>(getInitialEvents);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      console.error("Failed to store events in localStorage", error);
    }
  }, [events]);

  const addEvent = (event: CreateEventInput): Event => {
    const newEvent: Event = {
      ...event,
      id: event.id ?? generateEventId(),
      attendees: event.attendees ?? 0,
      createdAt: event.createdAt ?? new Date().toISOString(),
    };

    setEvents((prev) => [newEvent, ...prev]);

    return newEvent;
  };

  const value = useMemo(
    () => ({
      events,
      addEvent,
    }),
    [events]
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
