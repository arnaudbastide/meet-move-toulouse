import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, type VendorAccount } from '@/lib/supabase';

export const useVendorAccount = () => {
  const { user } = useAuth();

  const query = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ['vendor-account', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_accounts')
        .select('*')
        .eq('profile_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as VendorAccount | null;
    },
  });

  return {
    ...query,
    account: query.data ?? null,
  };
};
