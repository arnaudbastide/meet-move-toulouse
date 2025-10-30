import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Calendar, Users, Search } from "lucide-react";
import Navbar from "@/components/Navbar";

// Mock data for events
const mockEvents = [
  {
    id: 1,
    title: "Yoga at Jardin des Plantes",
    category: "Sports",
    date: "2025-11-02",
    time: "18:00",
    location: "Jardin des Plantes, Toulouse",
    attendees: 8,
    maxAttendees: 15,
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=400&fit=crop",
  },
  {
    id: 2,
    title: "French Conversation Meetup",
    category: "Language",
    date: "2025-11-03",
    time: "19:30",
    location: "Café Le Bibent, Toulouse",
    attendees: 12,
    maxAttendees: 20,
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=400&fit=crop",
  },
  {
    id: 3,
    title: "Photography Walk",
    category: "Arts",
    date: "2025-11-04",
    time: "14:00",
    location: "Canal du Midi, Toulouse",
    attendees: 5,
    maxAttendees: 10,
    image: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&h=400&fit=crop",
  },
  {
    id: 4,
    title: "Beach Volleyball",
    category: "Sports",
    date: "2025-11-05",
    time: "17:00",
    location: "Toulouse Plage",
    attendees: 16,
    maxAttendees: 20,
    image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&h=400&fit=crop",
  },
];

const Events = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ["All", "Sports", "Language", "Arts", "Food", "Music"];

  const filteredEvents = mockEvents.filter((event) => {
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
          {filteredEvents.map((event, index) => (
            <Card
              key={event.id}
              className="overflow-hidden hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="p-0">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                  />
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
                    View Details
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
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
