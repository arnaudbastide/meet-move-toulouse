import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface RoleGuardProps {
  children: JSX.Element;
  roleId: number;
  roleName: string;
}

const RoleGuard = ({ children, roleId, roleName }: RoleGuardProps) => {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!profile || profile.role_id !== roleId) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Accès restreint</h1>
          <p className="text-muted-foreground">
            Cette page est réservée aux {roleName}.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild>
              <Link to="/auth">Devenir {roleName}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export const VendorOnly = ({ children }: { children: JSX.Element }) => (
  <RoleGuard roleId={1} roleName="vendeurs">{children}</RoleGuard>
);

export const UserOnly = ({ children }: { children: JSX.Element }) => (
  <RoleGuard roleId={2} roleName="utilisateurs">{children}</RoleGuard>
);

// This is a placeholder. You should implement a proper admin check.
export const AdminOnly = ({ children }: { children: JSX.Element }) => {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  // In a real app, you'd have a more robust way to check for admin role.
  // This is just an example.
  const isAdmin = profile && profile.email === 'admin@example.com';

  if (!isAdmin) {
    return <Navigate to="/" />;
  }

  return children;
};