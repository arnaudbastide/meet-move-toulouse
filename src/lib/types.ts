export interface Event {
  id: string;
  vendor_id: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  currency: string;
  max_places: number;
  geom: any;
  address: string;
  created_at: string;
  organizer_name?: string | null;
  organizer_initials?: string | null;
  profiles?: {
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface EventSlot {
  id: string;
  event_id: string;
  start_at: string;
  end_at: string;
  booked_places: number;
}
