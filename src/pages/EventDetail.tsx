import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Calendar, Users, Clock, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { EventRecord } from "@/types/events";
import { getLocalEventById } from "@/lib/local-events";

const placeholderHeroImage =
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80";

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        setLoadError("Event not found.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Failed to load event", error);

        if (error.code === "42P01") {
          const fallbackEvent = getLocalEventById(id);

          if (fallbackEvent) {
            setEvent(fallbackEvent);
            setLoadError(null);
            toast.info(
              "Events storage has not been set up yet. Showing a locally cached version until Supabase migrations run.",
            );
            setIsLoading(false);
            return;
          }

          toast.error("Events storage has not been initialised. Please apply the Supabase migrations.");
          setLoadError(
            "Events storage has not been initialised. Please apply the latest Supabase migrations and try again.",
          );
          setIsLoading(false);
          return;
        }

        toast.error("Unable to load this event right now.");
        setLoadError("We couldn't load this event. Please try again later.");
        setIsLoading(false);
        return;
      }

      if (!data) {
        setLoadError("This event no longer exists or is unavailable.");
        setEvent(null);
        setIsLoading(false);
        return;
      }

      setEvent(data);
      setLoadError(null);
      setIsLoading(false);
    };

    fetchEvent();
  }, [id]);

  const attendeeInfo = useMemo(() => {
    const attendeeCount = event?.attendees_count ?? event?.attendees ?? 0;
    const maxAttendees = event?.max_attendees ?? event?.maxAttendees ?? attendeeCount;
    const spotsLeft = Math.max(maxAttendees - attendeeCount, 0);
    const progress = maxAttendees > 0 ? Math.min((attendeeCount / maxAttendees) * 100, 100) : 0;

    return {
      attendeeCount,
      maxAttendees,
      spotsLeft,
      progress,
    };
  }, [event]);

  const formatCategory = (category?: string | null) => {
    if (!category) return "Other";
    const trimmed = category.trim();
    if (!trimmed) return "Other";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  const formatDetailedDate = (date?: string | null) => {
    if (!date) return "Date to be announced";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return "Date to be announced";
    }

    return parsed.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (time?: string | null) => {
    if (!time) return "Time to be announced";
    return time.slice(0, 5);
  };

  const handleBooking = () => {
    if (!event) return;
    toast.success("Spot reserved! Check your email for details.");
  };

  const organizerName = event?.organizer_name ?? "Community Host";
  const derivedInitials = organizerName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  const organizerInitials = event?.organizer_initials || derivedInitials || "CH";

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

        {isLoading && (
          <div className="py-24 text-center text-muted-foreground">Loading event...</div>
        )}

        {!isLoading && loadError && (
          <div className="py-24 text-center text-muted-foreground">{loadError}</div>
        )}

        {!isLoading && !loadError && event && (
          <div className="space-y-8 animate-fade-in">
            {/* Hero Image */}
            <div className="relative h-96 rounded-xl overflow-hidden shadow-elevated">
              <img
                src={event.image_url ?? event.image ?? placeholderHeroImage}
                alt={event.title ?? "Community event"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-6">
                <Badge className="mb-3">{formatCategory(event.category)}</Badge>
                <h1 className="text-4xl font-bold text-white">{event.title ?? "Community Event"}</h1>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="md:col-span-2 space-y-6">
                <Card className="shadow-soft">
                  <CardContent className="pt-6">
                    <h2 className="text-2xl font-semibold mb-4">About This Event</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {event.description ?? "The organizer hasn't added a description yet."}
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
                          <p className="font-medium">Date &amp; Time</p>
                          <p className="text-muted-foreground">{formatDetailedDate(event.date)}</p>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatTime(event.time)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">Location</p>
                          <p className="text-muted-foreground">{event.location ?? "Location will be shared soon."}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Users className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">Attendees</p>
                          <p className="text-muted-foreground">
                            {attendeeInfo.maxAttendees > 0
                              ? `${attendeeInfo.attendeeCount} of ${attendeeInfo.maxAttendees} spots filled`
                              : `${attendeeInfo.attendeeCount} attendees`}
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
                          {attendeeInfo.maxAttendees > 0
                            ? `${attendeeInfo.spotsLeft} spots left`
                            : "Open attendance"}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-hero transition-all"
                          style={{ width: `${attendeeInfo.progress}%` }}
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
        )}
      </main>
    </div>
  );
};

export default EventDetail;
