import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Role = 'vendor' | 'user' | 'admin';

interface RoleGuardProps {
  role: Role;
  children: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ role, children }) => {
  const location = useLocation();
  const { loading, isVendor, isUser, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allowed =
    (role === 'vendor' && isVendor) ||
    (role === 'user' && isUser) ||
    (role === 'admin' && isAdmin);

  if (!allowed) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export const VendorOnly: React.FC<Omit<RoleGuardProps, 'role'>> = ({ children }) => (
  <RoleGuard role="vendor">{children}</RoleGuard>
);

export const UserOnly: React.FC<Omit<RoleGuardProps, 'role'>> = ({ children }) => (
  <RoleGuard role="user">{children}</RoleGuard>
);

export const AdminOnly: React.FC<Omit<RoleGuardProps, 'role'>> = ({ children }) => (
  <RoleGuard role="admin">{children}</RoleGuard>
);

export default RoleGuard;
