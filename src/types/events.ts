export type EventRecord = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  max_attendees: number | null;
  attendees_count: number | null;
  image_url: string | null;
  organizer_id: string | null;
  organizer_name: string | null;
  organizer_initials: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Legacy fields supported by earlier mock data
  maxAttendees?: number | null;
  attendees?: number | null;
  image?: string | null;
};
