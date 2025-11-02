import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock, MapPin, Users, Ticket } from "lucide-react";
import { useEvents } from "@/contexts/EventsContext";
import { toast } from "sonner";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=800&h=400&fit=crop";

const MyReservations = () => {
  const { reservedEvents, cancelReservation } = useEvents();

  const handleCancel = (eventId: string) => {
    const result = cancelReservation(eventId);

    if (!result?.event) {
      toast.error("Something went wrong while canceling your reservation.");
      return;
    }

    if (!result.success) {
      toast.error("You don't have a reservation for this event.");
      return;
    }

    toast.success(`Reservation for "${result.event.title}" has been canceled.`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Reservations</h1>
            <p className="text-muted-foreground">
              Keep track of the events you plan to attend and manage your bookings.
            </p>
          </div>
          <Link to="/events">
            <Button variant="secondary" className="inline-flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Browse More Events
            </Button>
          </Link>
        </div>

        {reservedEvents.length === 0 ? (
          <Card className="py-16 text-center animate-fade-in">
            <CardContent className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Ticket className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold">No reservations yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                When you reserve a spot at an event, it will appear here so you can review the details or cancel if your plans change.
              </p>
              <Link to="/events">
                <Button variant="hero">Find an event to join</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {reservedEvents.map((event, index) => (
              <Card
                key={event.id}
                className="overflow-hidden animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="p-0">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={event.image || FALLBACK_IMAGE}
                      alt={event.title}
                      className="h-full w-full object-cover"
                    />
                    <Badge className="absolute top-3 right-3 bg-background/90 backdrop-blur">{event.category}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {event.organizer?.initials || event.organizer?.name?.[0] || event.title.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-semibold leading-tight">{event.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        Organized by {event.organizer?.name || "Community Organizer"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>
                        {new Date(event.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>{event.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span>
                        {event.attendees} of {event.maxAttendees} spots filled
                      </span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-2 p-6 pt-0 sm:flex-row">
                  <Link to={`/events/${event.id}`} className="w-full">
                    <Button variant="outline" className="w-full">
                      View details
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleCancel(event.id)}
                  >
                    Cancel reservation
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyReservations;
