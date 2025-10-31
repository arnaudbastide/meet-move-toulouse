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
  status: string;
  created_at: string;
  profiles: {
    name: string;
    avatar_url: string;
  };
}

export interface EventSlot {
  id: string;
  event_id: string;
  start_at: string;
  end_at: string;
  booked_places: number;
}
