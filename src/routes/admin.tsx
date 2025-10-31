import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VendorAccountRow {
  profile_id: string;
  stripe_account_id: string | null;
  onboarding_complete: boolean | null;
  profile?: {
    name: string;
  } | null;
}

interface AdminEmailRow {
  email: string;
}

const AdminRoute: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'complete'>('all');

  const vendorAccountsQuery = useQuery({
    queryKey: ['admin', 'vendor-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_accounts')
        .select('*, profile:profiles(name)');
      if (error) throw error;
      return (data ?? []) as VendorAccountRow[];
    },
  });

  const adminEmailsQuery = useQuery({
    queryKey: ['admin', 'emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_emails')
        .select('email')
        .order('email');
      if (error) throw error;
      return (data ?? []) as AdminEmailRow[];
    },
  });

  const pendingCount = useMemo(
    () => (vendorAccountsQuery.data ?? []).filter((row) => !row.onboarding_complete).length,
    [vendorAccountsQuery.data],
  );

  const filteredData = useMemo(() => {
    const data = vendorAccountsQuery.data ?? [];
    if (statusFilter === 'all') return data;
    return data.filter((row) =>
      statusFilter === 'complete' ? Boolean(row.onboarding_complete) : !row.onboarding_complete,
    );
  }, [vendorAccountsQuery.data, statusFilter]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle>Suivi des comptes Stripe vendors</CardTitle>
            <CardDescription>
              {pendingCount > 0
                ? `${pendingCount} compte${pendingCount > 1 ? 's' : ''} nécessite une action.`
                : 'Tous les comptes vendors sont opérationnels.'}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Badge variant={pendingCount > 0 ? 'secondary' : 'outline'}>
              {pendingCount} en attente
            </Badge>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les comptes</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="complete">Onboarding terminé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Emails admin autorisés
            </h2>
            {adminEmailsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : (adminEmailsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun email admin configuré.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(adminEmailsQuery.data ?? []).map((row) => (
                  <Badge key={row.email} variant="outline" className="font-normal">
                    {row.email}
                  </Badge>
                ))}
              </div>
            )}
          </section>

          {vendorAccountsQuery.isLoading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : filteredData.length === 0 ? (
            <p className="text-muted-foreground">Aucun compte ne correspond à ce filtre.</p>
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
                {filteredData.map((row) => (
                  <TableRow key={row.profile_id}>
                    <TableCell>{row.profile?.name ?? row.profile_id}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.stripe_account_id ?? (
                        <Badge variant="destructive" className="font-normal">
                          À créer
                        </Badge>
                      )}
                    </TableCell>
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
