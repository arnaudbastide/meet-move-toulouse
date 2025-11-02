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
              {profile?.role_id === 1 && <Link to="/vendor-dashboard">Tableau vendor</Link>}
              {profile?.role_id === 1 && <Link to="/create">Créer un événement</Link>}
              {profile?.role_id === 2 && <Link to="/bookings">Mes réservations</Link>}
              {!profile || profile.role_id !== 1 ? (
                <Link to="/auth">Devenir vendor</Link>
              ) : null}
              <span>{user.email}</span>
              <button onClick={handleLogout}>Déconnexion</button>
            </>
          ) : (
            <Link to="/auth">Connexion</Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;