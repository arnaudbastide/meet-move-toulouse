import type { EventRecord } from "@/types/events";
import { sampleEvents } from "@/data/sample-events";

const STORAGE_KEY = "meet-move-toulouse:fallback-events";

const parseEvents = (rawValue: string | null): EventRecord[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is EventRecord => typeof item === "object" && item !== null);
  } catch (error) {
    console.warn("Failed to parse cached events", error);
    return [];
  }
};

const persistEvents = (events: EventRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    console.warn("Failed to persist fallback events", error);
  }
};

export const getLocalEvents = (): EventRecord[] => {
  const existing = parseEvents(localStorage.getItem(STORAGE_KEY));

  if (existing.length > 0) {
    return existing;
  }

  persistEvents(sampleEvents);
  return sampleEvents;
};

export const getLocalEventById = (id: string): EventRecord | undefined => {
  return getLocalEvents().find((event) => event.id === id);
};

export const addLocalEvent = (event: EventRecord) => {
  const events = getLocalEvents();
  const nextEvents = [...events.filter((existing) => existing.id !== event.id), event];
  persistEvents(nextEvents);
};

export const upsertLocalEvents = (events: EventRecord[]) => {
  if (events.length === 0) {
    return;
  }

  const current = getLocalEvents();
  const mergedMap = new Map<string, EventRecord>();

  for (const existing of current) {
    mergedMap.set(existing.id, existing);
  }

  for (const incoming of events) {
    mergedMap.set(incoming.id, incoming);
  }

  persistEvents(Array.from(mergedMap.values()));
};
