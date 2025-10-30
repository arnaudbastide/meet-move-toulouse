import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Calendar, Users, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { EventRecord } from "@/types/events";
import { getLocalEvents, upsertLocalEvents } from "@/lib/local-events";

type CategoryOption = {
  value: string;
  label: string;
};

const Events = () => {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });

      if (error) {
        console.error("Failed to fetch events", error);

        if (error.code === "42P01") {
          const fallbackEvents = getLocalEvents();
          setEvents(fallbackEvents);
          toast.info(
            "Events storage has not been set up yet. Showing sample events until Supabase migrations are applied.",
          );
          setIsLoading(false);
          return;
        }

        toast.error("Unable to load events right now. Please try again later.");
        setIsLoading(false);
        return;
      }

      const safeEvents = data ?? [];
      setEvents(safeEvents);
      upsertLocalEvents(safeEvents);
      setIsLoading(false);
    };

    fetchEvents();
  }, []);

  const categories = useMemo<CategoryOption[]>(() => {
    const preset: CategoryOption[] = [
      { value: "all", label: "All" },
      { value: "sports", label: "Sports" },
      { value: "language", label: "Language" },
      { value: "arts", label: "Arts" },
      { value: "food", label: "Food" },
      { value: "music", label: "Music" },
    ];

    const dynamic = events
      .map((event) => event.category)
      .filter((category): category is string => Boolean(category))
      .map((category) => {
        const trimmed = category.trim();
        const value = trimmed.toLowerCase();
        const label = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        return { value, label };
      });

    const merged = [...preset, ...dynamic];
    const unique = new Map<string, CategoryOption>();

    merged.forEach((option) => {
      if (!unique.has(option.value)) {
        unique.set(option.value, option);
      }
    });

    return Array.from(unique.values());
  }, [events]);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return events.filter((event) => {
      const title = (event.title ?? "").toLowerCase();
      const description = (event.description ?? "").toLowerCase();
      const category = (event.category ?? "").toLowerCase();

      const matchesSearch =
        !normalizedSearch || title.includes(normalizedSearch) || description.includes(normalizedSearch);
      const matchesCategory = selectedCategory === "all" || category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  const formatCategory = (category?: string | null) => {
    if (!category) return "Other";
    const trimmed = category.trim();
    if (!trimmed) return "Other";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  const formatDate = (date?: string | null) => {
    if (!date) return "Date to be announced";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return "Date to be announced";
    }

    return parsed.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (time?: string | null) => {
    if (!time) return null;
    return time.slice(0, 5);
  };

  const placeholderImage =
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2">Discover Events</h1>
          <p className="text-muted-foreground">Find and join activities in Toulouse</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category.value}
                variant={selectedCategory === category.value ? "default" : "outline"}
                className="cursor-pointer transition-all hover:scale-105"
                onClick={() => setSelectedCategory(category.value)}
              >
                {category.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Loading events...
            </div>
          )}

          {!isLoading && filteredEvents.length === 0 && (
            <div className="col-span-full text-center py-12 animate-fade-in">
              <p className="text-muted-foreground text-lg">No events found matching your criteria</p>
            </div>
          )}

          {!isLoading &&
            filteredEvents.map((event, index) => {
              const attendeeCount = event.attendees_count ?? event.attendees ?? 0;
              const maxAttendees = event.max_attendees ?? event.maxAttendees ?? attendeeCount;
              const formattedDate = formatDate(event.date);
              const formattedTime = formatTime(event.time);
              const image = event.image_url ?? event.image ?? placeholderImage;

              return (
                <Card
                  key={event.id}
                  className="overflow-hidden hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader className="p-0">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={image}
                        alt={event.title ?? "Community event"}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                      />
                      <Badge className="absolute top-3 right-3 bg-background/90 backdrop-blur">
                        {formatCategory(event.category)}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5">
                    <h3 className="font-semibold text-lg mb-3 line-clamp-2">{event.title}</h3>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>
                          {formattedDate}
                          {formattedTime ? ` at ${formattedTime}` : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="line-clamp-1">{event.location ?? "Toulouse"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span>
                          {maxAttendees > 0
                            ? `${attendeeCount}/${maxAttendees} attendees`
                            : `${attendeeCount} attendees`}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-5 pt-0">
                    <Link to={`/events/${event.id}`} className="w-full">
                      <Button className="w-full" variant="default">
                        View Details
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
        </div>
      </main>
    </div>
  );
};

export default Events;
