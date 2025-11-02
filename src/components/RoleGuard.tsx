import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface RoleGuardProps {
  children: JSX.Element;
  roleId: number;
}

const RoleGuard = ({ children, roleId }: RoleGuardProps) => {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  if (!profile || profile.role_id !== roleId) {
    return <Navigate to="/" />;
  }

  return children;
};

export const VendorOnly = ({ children }: { children: JSX.Element }) => (
  <RoleGuard roleId={1}>{children}</RoleGuard>
);

export const UserOnly = ({ children }: { children: JSX.Element }) => (
  <RoleGuard roleId={2}>{children}</RoleGuard>
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