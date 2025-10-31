import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const useRole = () => {
  const { isVendor, isUser, isAdmin, loading } = useAuth();

  return useMemo(
    () => ({
      isVendor,
      isUser,
      isAdmin,
      loading,
    }),
    [isVendor, isUser, isAdmin, loading],
  );
};
