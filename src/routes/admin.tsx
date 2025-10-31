import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface VendorAccountRow {
  profile_id: string;
  stripe_account_id: string;
  onboarding_complete: boolean;
  profile?: {
    name: string;
  } | null;
}

const AdminRoute: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'vendor-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_accounts')
        .select('*, profile:profiles(name)');
      if (error) throw error;
      return (data ?? []) as VendorAccountRow[];
    },
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Suivi des comptes Stripe vendors</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Stripe account</TableHead>
                  <TableHead>Onboarding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((row) => (
                  <TableRow key={row.profile_id}>
                    <TableCell>{row.profile?.name ?? row.profile_id}</TableCell>
                    <TableCell className="font-mono text-xs">{row.stripe_account_id}</TableCell>
                    <TableCell>
                      <Badge variant={row.onboarding_complete ? 'default' : 'secondary'}>
                        {row.onboarding_complete ? 'Terminé' : 'En attente'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default AdminRoute;
