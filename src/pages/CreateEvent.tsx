import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { useEvents } from "@/contexts/EventsContext";
import { useAuth } from "@/contexts/AuthContext";

const CreateEvent = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState<string>("");
  const { addEvent } = useEvents();
  const { user, profile } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in to create an event.");
      navigate("/auth");
      return;
    }

    if (!category) {
      toast.error("Please select a category for your event.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);

      const title = ((formData.get("title") as string | null) ?? "").trim();
      const description = ((formData.get("description") as string | null) ?? "").trim();
      const date = (formData.get("date") as string | null) ?? "";
      const time = (formData.get("time") as string | null) ?? "";
      const location = ((formData.get("location") as string | null) ?? "").trim();
      const maxAttendees = Number(formData.get("maxAttendees"));
      const imageUrl = ((formData.get("image") as string | null) ?? "").trim();

      if (!title || !description || !date || !time || !location) {
        toast.error("Please fill in all required fields.");
        return;
      }

      const safeMaxAttendees = Number.isNaN(maxAttendees) ? 0 : Math.max(1, maxAttendees);

      if (safeMaxAttendees <= 0) {
        toast.error("Please provide a valid number of maximum attendees.");
        return;
      }

      const userName = profile?.full_name || user.email || "Community Organizer";
      const userInitials = userName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const newEvent = await addEvent({
        title,
        description,
        category,
        date,
        time,
        location,
        maxAttendees: safeMaxAttendees,
        image:
          imageUrl ||
          "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=800&h=400&fit=crop",
        organizer: {
          name: userName,
          initials: userInitials,
        },
      });

      if (!newEvent) {
        toast.error("Failed to create event. Please try again.");
        return;
      }

      toast.success("Event created successfully!");
      e.currentTarget.reset();
      setCategory("");
      navigate(`/events/${newEvent.id}`);
    } catch (error) {
      console.error("Failed to create event", error);
      toast.error("Something went wrong while creating the event.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2">Create New Event</h1>
          <p className="text-muted-foreground">Share your activity with the community</p>
        </div>

        <Card className="animate-fade-in shadow-soft">
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Fill in the information about your event</CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g., Morning Yoga Session"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe your event..."
                  rows={4}
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sports">Sports</SelectItem>
                    <SelectItem value="Language">Language</SelectItem>
                    <SelectItem value="Arts">Arts</SelectItem>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Music">Music</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="time">Time *</Label>
                  <Input
                    id="time"
                    name="time"
                    type="time"
                    required
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    name="location"
                    placeholder="Enter location in Toulouse"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Max Attendees */}
              <div className="space-y-2">
                <Label htmlFor="maxAttendees">Maximum Attendees *</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="maxAttendees"
                    name="maxAttendees"
                    type="number"
                    min="2"
                    max="100"
                    placeholder="e.g., 20"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="image">Event Image (Optional)</Label>
                <Input
                  id="image"
                  name="image"
                  type="url"
                  placeholder="https://example.com/event-image.jpg"
                  pattern="https?://.+"
                />
                <p className="text-xs text-muted-foreground">Use a direct image URL. Recommended size: 800x400px.</p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/events")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Event"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CreateEvent;
