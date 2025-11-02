import { Event } from '@/lib/types';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EventCardProps {
  event: Event;
}

const EventCard = ({ event }: EventCardProps) => {
  return (
    <Link to={`/event/${event.id}`}>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>{event.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <img src="/public/images/course-canal-du-midi.svg" alt={event.title} className="rounded-md mb-4" />
          <p className="text-muted-foreground">{event.description}</p>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Badge>{event.category}</Badge>
          <span>{new Date(event.created_at).toLocaleDateString()}</span>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default EventCard;