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
  status?: string;
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

export interface Booking {
  id: string;
  user_id: string;
  slot_id: string;
  status: 'booked' | 'cancelled' | 'checked_in';
  price_cents: number;
  platform_fee_cents: number;
  net_payout_cents: number;
  payment_intent_id: string | null;
  created_at: string;
  event_slots?: EventSlot & {
    events?: Event;
  };
}

export interface VendorDashboardTotals {
  bookingsCount: number;
  totalRevenue: number;
  eventsCount: number;
}

export interface VendorEventWithStats {
  id: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  address: string;
  created_at: string;
  slots_count: number;
  revenue: number;
}
