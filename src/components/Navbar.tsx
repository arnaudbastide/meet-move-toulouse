import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { Button } from "./ui/button";
import { MapPin, Calendar, Plus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const displayName = (() => {
    if (!session) return null;
    const metadata = session.user.user_metadata as Record<string, unknown>;
    const rawName = ["full_name", "fullName", "name"]
      .map((key) => metadata[key])
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (rawName) {
      return rawName.trim().split(" ")[0];
    }

    const emailPrefix = session.user.email?.split("@")[0];
    return emailPrefix ?? "Member";
  })();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Failed to sign out", error);
      toast.error("Unable to sign out. Please try again.");
      return;
    }

    toast.success("Signed out successfully.");
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              Meet & Move
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/events"
              className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                isActive("/events") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Events
            </Link>
            <Link
              to="/create"
              className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                isActive("/create") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Plus className="h-4 w-4" />
              Create
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <>
                <span className="hidden md:inline text-sm text-muted-foreground">Hi, {displayName}</span>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <User className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
                <Link to="/create" className="hidden md:block">
                  <Button variant="hero" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="outline" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </Link>
                <Link to="/create" className="hidden md:block">
                  <Button variant="hero" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
