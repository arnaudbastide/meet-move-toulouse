import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const Navbar = () => {
  const { user, profile } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="bg-primary text-primary-foreground p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">Meet & Move</Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {profile?.role_id === 1 && <Link to="/vendor-dashboard">Dashboard</Link>}
              {profile?.role_id === 1 && <Link to="/create">Create Event</Link>}
              {profile?.role_id === 2 && <Link to="/bookings">My Bookings</Link>}
              <span>{user.email}</span>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <Link to="/auth">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;