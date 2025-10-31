import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Home, LayoutDashboard, LogOut, Plus, ShieldCheck, Ticket } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';

const Navbar: React.FC = () => {
  const { user, signOut, profile } = useAuth();
  const { isUser, isAdmin } = useRole();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const isVendor = Boolean(user && profile?.role_id === 1);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="rounded bg-primary px-2 py-1 text-primary-foreground">Meet</span>
            <span className="text-primary">&amp;</span>
            <span>Move</span>
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-medium md:flex">
            <Link className={isActive('/') ? 'text-primary' : 'text-muted-foreground'} to="/">
              <Home className="mr-1 inline size-4" /> Carte &amp; liste
            </Link>
            {isVendor ? (
              <>
                <Link
                  className={isActive('/create') ? 'text-primary' : 'text-muted-foreground'}
                  to="/create"
                >
                  <Plus className="mr-1 inline size-4" /> Créer un événement
                </Link>
                <Link
                  className={isActive('/vendor-dashboard') ? 'text-primary' : 'text-muted-foreground'}
                  to="/vendor-dashboard"
                >
                  <LayoutDashboard className="mr-1 inline size-4" /> Tableau vendor
                </Link>
              </>
            ) : (
              <Link
                className={isActive('/auth') ? 'text-primary' : 'text-muted-foreground'}
                to="/auth"
              >
                <ShieldCheck className="mr-1 inline size-4" /> Devenir vendor
              </Link>
            )}
            {isUser && (
              <Link
                className={isActive('/bookings') ? 'text-primary' : 'text-muted-foreground'}
                to="/bookings"
              >
                <Ticket className="mr-1 inline size-4" /> Mes réservations
              </Link>
            )}
            {isAdmin && (
              <Link
                className={isActive('/admin') ? 'text-primary' : 'text-muted-foreground'}
                to="/admin"
              >
                <ShieldCheck className="mr-1 inline size-4" /> Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {!user && (
            <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
              Connexion
            </Button>
          )}
          {user && (
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 size-4" /> Déconnexion
            </Button>
          )}
          <Button size="sm" onClick={() => navigate(isVendor ? '/create' : '/auth')}>
            <Calendar className="mr-2 size-4" /> {isVendor ? 'Créer un événement' : 'Devenir vendor'}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
