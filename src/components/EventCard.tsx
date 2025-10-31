import { Link } from 'react-router-dom';
import { Calendar, MapPin, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';
import type { EventRecord } from '@/lib/supabase';

interface EventCardProps {
  event: EventRecord & { vendor_name?: string | null; next_slot?: string | null };
  variant?: 'list' | 'dashboard';
}

export const EventCard: React.FC<EventCardProps> = ({ event, variant = 'list' }) => {
  const price = formatPrice(event.price_cents, event.currency?.toUpperCase() ?? 'EUR');

  return (
    <Card className="transition hover:shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center justify-between">
          <Link to={`/event/${event.id}`} className="hover:underline">
            {event.title}
          </Link>
          <span className="text-sm font-medium text-muted-foreground">{price}</span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {event.vendor_name && <span>Par {event.vendor_name}</span>}
          {event.category && (
            <span className="flex items-center gap-1">
              <Tag className="size-4" /> {event.category}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MapPin className="size-4" /> {event.address}
          </span>
          {event.next_slot && (
            <span className="flex items-center gap-1">
              <Calendar className="size-4" /> {new Date(event.next_slot).toLocaleString('fr-FR')}
            </span>
          )}
        </div>
      </CardHeader>
      {variant === 'dashboard' && (
        <CardContent className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <div className="font-medium text-foreground">Places max</div>
            <div>{event.max_places}</div>
          </div>
          <div>
            <div className="font-medium text-foreground">Statut</div>
            <div className="capitalize">{event.status}</div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
