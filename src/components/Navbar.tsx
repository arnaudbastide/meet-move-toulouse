import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { MapPin, Calendar, Plus, User, Ticket, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, signOut, profile } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = () => {
    signOut();
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
            {profile?.role_id === 1 && (
              <>
                <Link
                  to="/vendor-dashboard"
                  className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/vendor-dashboard") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Vendor Dashboard
                </Link>
                <Link
                  to="/create"
                  className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/create") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Create Event
                </Link>
              </>
            )}
            {profile?.role_id !== 1 && isAuthenticated && (
              <Link
                to="/auth"
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                  isActive("/auth") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Become a vendor
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <User className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
