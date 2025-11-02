import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';
import { Event } from '@/lib/types';

const fetchVendorEvents = async (vendorId: string): Promise<Event[]> => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('vendor_id', vendorId);

  if (error) {
    throw new Error(error.message);
  }

  return data as Event[];
};

const fetchVendorAccount = async (profileId: string) => {
  const { data, error } = await supabase
    .from('vendor_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  return data;
};

const VendorDashboardRoute = () => {
  const { user, profile } = useAuth();
  const { mutate: initiateOnboarding, isPending } = useStripeOnboarding();

  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['vendorEvents', user?.id],
    queryFn: () => fetchVendorEvents(user!.id),
    enabled: !!user,
  });

  const { data: vendorAccount, isLoading: isLoadingAccount } = useQuery({
    queryKey: ['vendorAccount', user?.id],
    queryFn: () => fetchVendorAccount(user!.id),
    enabled: !!user,
  });

  const handleOnboarding = () => {
    if (user && profile) {
      initiateOnboarding({
        profileId: profile.id,
        email: user.email!,
        refreshUrl: window.location.href,
        returnUrl: window.location.href,
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Vendor Dashboard</h1>
      <div className="mb-8">
        <h2 className="text-xl font-semibold">Stripe Account</h2>
        {isLoadingAccount ? (
          <p>Loading...</p>
        ) : vendorAccount?.onboarding_complete ? (
          <p className="text-green-500">Onboarding Complete</p>
        ) : (
          <div>
            <p className="text-yellow-500">Onboarding Incomplete</p>
            <Button onClick={handleOnboarding} disabled={isPending}>
              {isPending ? 'Redirecting...' : 'Complete Onboarding'}
            </Button>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold">My Events</h2>
        {isLoadingEvents ? (
          <p>Loading...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {events?.map((event) => (
              <div key={event.id} className="p-4 border rounded-md">
                <h3 className="font-semibold">{event.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(event.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorDashboardRoute;
