import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { MapPin, Calendar, Plus, User } from "lucide-react";

const Navbar = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

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
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
