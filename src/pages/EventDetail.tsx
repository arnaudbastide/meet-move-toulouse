import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Calendar, Users, Clock, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { useEvents } from "@/contexts/EventsContext";

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { events, reserveSpot, cancelReservation, isEventReserved } = useEvents();
  const event = events.find((item) => item.id === id);

  const fallbackImage = "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=1200&h=600&fit=crop";

  const organizerName = event?.organizer?.name ?? "Community Organizer";
  const organizerInitials = event?.organizer?.initials
    ?? organizerName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const isReserved = event ? isEventReserved(event.id) : false;
  const spotsLeft = event ? Math.max(0, event.maxAttendees - event.attendees) : 0;
  const isFullyBooked = spotsLeft === 0 && !isReserved;

  const handleBooking = () => {
    if (!event) {
      toast.error("Unable to find this event.");
      return;
    }

    const result = reserveSpot(event.id);

    if (!result.event) {
      toast.error("Something went wrong while reserving your spot.");
      return;
    }

    if (!result.success) {
      toast.error("Sorry, this event is fully booked.");
      return;
    }

    toast.success("Spot reserved! Check your email for details.");
  };

  const handleCancellation = () => {
    if (!event) {
      toast.error("Unable to find this event.");
      return;
    }

    const result = cancelReservation(event.id);

    if (!result?.event) {
      toast.error("Something went wrong while canceling your reservation.");
      return;
    }

    if (!result.success) {
      toast.error("You don't have a reservation for this event.");
      return;
    }

    toast.success("Your reservation has been canceled.");
  };

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-16 max-w-3xl text-center space-y-6">
          <h1 className="text-3xl font-bold">Event not found</h1>
          <p className="text-muted-foreground">
            The event you are looking for may have been removed or is no longer available.
          </p>
          <Button onClick={() => navigate("/events")}>Back to Events</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-6 -ml-4"
          onClick={() => navigate("/events")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>

        <div className="space-y-8 animate-fade-in">
          {/* Hero Image */}
          <div className="relative h-96 rounded-xl overflow-hidden shadow-elevated">
            <img
              src={event.image || fallbackImage}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6">
              <Badge className="mb-3">{event.category}</Badge>
              <h1 className="text-4xl font-bold text-white">{event.title}</h1>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="md:col-span-2 space-y-6">
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <h2 className="text-2xl font-semibold mb-4">About This Event</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {event.description || "Details for this event will be shared soon."}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <h2 className="text-2xl font-semibold mb-4">Event Details</h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Date & Time</p>
                        <p className="text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("en-US", { 
                            weekday: "long", 
                            year: "numeric",
                            month: "long", 
                            day: "numeric" 
                          })}
                        </p>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {event.time}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Location</p>
                        <p className="text-muted-foreground">{event.location}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Attendees</p>
                        <p className="text-muted-foreground">
                          {event.attendees} of {event.maxAttendees} spots filled
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="shadow-soft sticky top-24">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {organizerInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm text-muted-foreground">Organized by</p>
                      <p className="font-medium">{organizerName}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Availability</span>
                      <span className="font-medium">
                        {spotsLeft > 0
                          ? `${spotsLeft} spots left`
                          : isReserved
                            ? "You're reserved"
                            : "Fully booked"}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-hero transition-all"
                        style={{ width: `${(event.attendees / event.maxAttendees) * 100}%` }}
                      />
                    </div>
                  </div>

                  {isReserved ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      size="lg"
                      onClick={handleCancellation}
                    >
                      Cancel Reservation
                    </Button>
                  ) : (
                    <Button
                      variant="hero"
                      className="w-full"
                      size="lg"
                      onClick={handleBooking}
                      disabled={isFullyBooked}
                    >
                      {isFullyBooked ? "Fully Booked" : "Reserve Your Spot"}
                    </Button>
                  )}

                  <p className="text-xs text-center text-muted-foreground">
                    {isReserved
                      ? "You're all set! Cancel any time before the event starts."
                      : "Free cancellation up to 24 hours before"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EventDetail;
