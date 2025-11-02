import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Calendar, Users, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useEvents } from "@/contexts/EventsContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=800&h=400&fit=crop";

const Events = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { events, isEventReserved } = useEvents();

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(events.map((event) => event.category)));
    return ["All", ...uniqueCategories];
  }, [events]);

  useEffect(() => {
    if (
      selectedCategory &&
      selectedCategory !== "All" &&
      !events.some((event) => event.category === selectedCategory)
    ) {
      setSelectedCategory(null);
    }
  }, [events, selectedCategory]);

  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === "All" || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
                key={category}
                variant={selectedCategory === category || (selectedCategory === null && category === "All") ? "default" : "outline"}
                className="cursor-pointer transition-all hover:scale-105"
                onClick={() => setSelectedCategory(category === "All" ? null : category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event, index) => {
            const reserved = isEventReserved(event.id);

            return (
            <Card
              key={event.id}
              className="overflow-hidden hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="p-0">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={event.image || FALLBACK_IMAGE}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                  />
                  {reserved && (
                    <Badge className="absolute top-3 left-3 bg-emerald-500 text-white shadow-md">
                      Reserved
                    </Badge>
                  )}
                  <Badge className="absolute top-3 right-3 bg-background/90 backdrop-blur">
                    {event.category}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="p-5">
                <h3 className="font-semibold text-lg mb-3 line-clamp-2">{event.title}</h3>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{new Date(event.date).toLocaleDateString("en-US", { 
                      weekday: "short", 
                      month: "short", 
                      day: "numeric" 
                    })} at {event.time}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="line-clamp-1">{event.location}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{event.attendees}/{event.maxAttendees} attendees</span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="p-5 pt-0">
                <Link to={`/events/${event.id}`} className="w-full">
                  <Button className="w-full" variant="default">
                    {reserved ? "View & Manage" : "View Details"}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
            );
          })}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <p className="text-muted-foreground text-lg">No events found matching your criteria</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Events;
