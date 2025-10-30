import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Users, Image as ImageIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const formSchema = z.object({
  title: z
    .string()
    .min(1, "Please provide a title for your event"),
  description: z
    .string()
    .min(1, "Please add a short description"),
  category: z
    .string({ required_error: "Please select a category" })
    .min(1, "Please select a category"),
  date: z
    .string()
    .min(1, "Please choose a date"),
  time: z
    .string()
    .min(1, "Please choose a start time"),
  location: z
    .string()
    .min(1, "Please provide a location"),
  maxAttendees: z
    .coerce
    .number({ invalid_type_error: "Please enter a valid number" })
    .int("Maximum attendees must be a whole number")
    .min(2, "At least two attendees are required")
    .max(100, "Maximum attendees cannot exceed 100"),
});

type FormValues = z.infer<typeof formSchema>;

const CreateEvent = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setIsSessionLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      date: "",
      time: "",
      location: "",
      maxAttendees: 10,
    },
  });

  const deriveOrganizerDetails = (activeSession: Session) => {
    const metadata = activeSession.user.user_metadata as Record<string, unknown>;
    const metadataName = ["full_name", "fullName", "name"]
      .map((key) => metadata[key])
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

    const fallbackName = activeSession.user.email ?? "Community Host";
    const organizerName = metadataName?.trim() ?? fallbackName;

    const initials = organizerName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2);

    return {
      organizerName,
      organizerInitials: initials || "CH",
    };
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (!activeSession) {
        toast.error("Please sign in to create an event.");
        navigate("/auth");
        return;
      }

      const { organizerName, organizerInitials } = deriveOrganizerDetails(activeSession);

      const { error } = await supabase
        .from("events")
        .insert([
          {
            title: values.title,
            description: values.description,
            category: values.category,
            date: values.date,
            time: values.time,
            location: values.location,
            max_attendees: values.maxAttendees,
            attendees_count: 0,
            organizer_name: organizerName,
            organizer_initials: organizerInitials,
          },
        ]);

      if (error) {
        console.error("Failed to create event", error);
        toast.error(error.message || "Unable to create the event. Please try again.");
        return;
      }

      toast.success("Event created successfully!");
      reset();
      navigate("/events");
    } catch (error) {
      console.error("Unexpected error while creating event", error);
      toast.error("Something went wrong while creating your event.");
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

        {!isSessionLoading && !session && (
          <div className="mb-6 rounded-lg border border-dashed border-muted p-4 text-sm text-muted-foreground">
            You need to be signed in to create an event. Please sign in or create an account first.
          </div>
        )}

        <Card className="animate-fade-in shadow-soft">
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Fill in the information about your event</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Morning Yoga Session"
                  disabled={isSubmitting}
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your event..."
                  rows={4}
                  disabled={isSubmitting}
                  {...register("description")}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sports">Sports</SelectItem>
                        <SelectItem value="language">Language</SelectItem>
                        <SelectItem value="arts">Arts</SelectItem>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="music">Music</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="date"
                      type="date"
                      className="pl-10"
                      disabled={isSubmitting}
                      {...register("date")}
                    />
                  </div>
                  {errors.date && (
                    <p className="text-sm text-destructive">{errors.date.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    disabled={isSubmitting}
                    {...register("time")}
                  />
                  {errors.time && (
                    <p className="text-sm text-destructive">{errors.time.message}</p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="Enter location in Toulouse"
                    className="pl-10"
                    disabled={isSubmitting}
                    {...register("location")}
                  />
                </div>
                {errors.location && (
                  <p className="text-sm text-destructive">{errors.location.message}</p>
                )}
              </div>

              {/* Max Attendees */}
              <div className="space-y-2">
                <Label htmlFor="maxAttendees">Maximum Attendees *</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="maxAttendees"
                    type="number"
                    min="2"
                    max="100"
                    placeholder="e.g., 20"
                    className="pl-10"
                    disabled={isSubmitting}
                    {...register("maxAttendees")}
                  />
                </div>
                {errors.maxAttendees && (
                  <p className="text-sm text-destructive">{errors.maxAttendees.message}</p>
                )}
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="image">Event Image (Optional)</Label>
                <div className="flex items-center gap-4">
                  <Button type="button" variant="outline" className="w-full" disabled={isSubmitting}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Recommended: 800x400px, max 5MB</p>
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
