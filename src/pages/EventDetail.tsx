import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Calendar, Users, Clock, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock event data
  const event = {
    id: 1,
    title: "Yoga at Jardin des Plantes",
    category: "Sports",
    date: "2025-11-02",
    time: "18:00",
    location: "Jardin des Plantes, Toulouse",
    description: "Join us for a relaxing outdoor yoga session in one of Toulouse's most beautiful gardens. All levels welcome! Bring your own mat and water.",
    attendees: 8,
    maxAttendees: 15,
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&h=600&fit=crop",
    organizer: {
      name: "Sophie Martin",
      initials: "SM",
    },
  };

  const handleBooking = () => {
    toast.success("Spot reserved! Check your email for details.");
  };

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
              src={event.image}
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
                    {event.description}
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
                        {event.organizer.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm text-muted-foreground">Organized by</p>
                      <p className="font-medium">{event.organizer.name}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Availability</span>
                      <span className="font-medium">
                        {event.maxAttendees - event.attendees} spots left
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-hero transition-all"
                        style={{ width: `${(event.attendees / event.maxAttendees) * 100}%` }}
                      />
                    </div>
                  </div>

                  <Button
                    variant="hero"
                    className="w-full"
                    size="lg"
                    onClick={handleBooking}
                  >
                    Reserve Your Spot
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Free cancellation up to 24 hours before
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
