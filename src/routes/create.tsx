import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatISO } from 'date-fns';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PriceField } from '@/components/PriceField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useVendorAccount } from '@/hooks/useVendorAccount';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';

const slotSchema = z.object({
  start_at: z.string().min(1, 'Date de début requise'),
  end_at: z.string().min(1, 'Date de fin requise'),
});

const eventSchema = z.object({
  title: z.string().min(3, 'Titre trop court'),
  description: z.string().optional(),
  category: z.enum(['sport', 'culture', 'food', 'games', 'other']),
  price_cents: z.number().min(0),
  max_places: z.number().int().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(5),
  slots: z.array(slotSchema).min(1, 'Ajoutez au moins un créneau'),
});

type EventFormValues = z.infer<typeof eventSchema>;

const defaultValues: EventFormValues = {
  title: '',
  description: '',
  category: 'sport',
  price_cents: 0,
  max_places: 10,
  latitude: 43.6047,
  longitude: 1.4442,
  address: '',
  slots: [
    {
      start_at: formatISO(new Date(), { representation: 'complete' }).slice(0, 16),
      end_at: formatISO(new Date(Date.now() + 60 * 60 * 1000), { representation: 'complete' }).slice(0, 16),
    },
  ],
};

const CreateRoute: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { account, isLoading: accountLoading } = useVendorAccount();
  const { startOnboarding, starting } = useStripeOnboarding();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    name: 'slots',
    control: form.control,
  });

  const mutation = useMutation({
    mutationFn: async (values: EventFormValues) => {
      const payload = {
        p_title: values.title,
        p_desc: values.description ?? '',
        p_cat: values.category,
        p_price_cents: values.price_cents,
        p_max: values.max_places,
        p_lat: values.latitude,
        p_lng: values.longitude,
        p_addr: values.address,
        p_slots: values.slots.map((slot) => ({
          start_at: new Date(slot.start_at).toISOString(),
          end_at: new Date(slot.end_at).toISOString(),
        })),
      };
      const { data, error } = await supabase.rpc('create_event_with_slots', payload);
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const onSubmit = async (values: EventFormValues) => {
    if (accountLoading) {
      toast.error('Chargement du statut Stripe en cours, réessayez dans un instant.');
      return;
    }

    if (!account?.onboarding_complete) {
      toast.error('Finalisez votre onboarding Stripe avant de publier un événement.');
      return;
    }

    try {
      await mutation.mutateAsync(values);
      toast.success('Événement créé');
      form.reset(defaultValues);
    } catch (error: any) {
      toast.error(error.message ?? 'Erreur lors de la création');
    }
  };

  if (!user) {
    return <p className="p-8 text-center text-muted-foreground">Connectez-vous pour créer un événement.</p>;
  }

  const onboardingComplete = Boolean(account?.onboarding_complete);
  const creationLocked = accountLoading || !onboardingComplete;
  const isSubmitting = mutation.isPending;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Publier une nouvelle expérience</CardTitle>
        </CardHeader>
        <CardContent>
          {creationLocked && (
            <div className="mb-6 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-4 text-sm text-muted-foreground">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {accountLoading
                    ? 'Chargement du statut Stripe...'
                    : 'Finalisez votre onboarding Stripe pour publier vos expériences.'}
                </p>
                {!accountLoading && (
                  <Button
                    type="button"
                    onClick={() => {
                      void startOnboarding({ returnPath: '/create' });
                    }}
                    disabled={starting}
                  >
                    {starting && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {starting ? 'Redirection vers Stripe...' : 'Continuer sur Stripe'}
                  </Button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <fieldset disabled={creationLocked || isSubmitting} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre</Label>
                  <Input id="title" data-testid="create-title" {...form.register('title')} />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Controller
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sport">Sport</SelectItem>
                          <SelectItem value="culture">Culture</SelectItem>
                          <SelectItem value="food">Gastronomie</SelectItem>
                          <SelectItem value="games">Jeux</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={4} data-testid="create-description" {...form.register('description')} />
              </div>

              <Controller
                control={form.control}
                name="price_cents"
                render={({ field }) => <PriceField field={field} currency="EUR" />}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="max_places">Places maximum</Label>
                  <Input
                    id="max_places"
                    type="number"
                    min={1}
                    data-testid="create-max"
                    {...form.register('max_places', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input data-testid="create-address" {...form.register('address')} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    data-testid="create-lat"
                    {...form.register('latitude', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    data-testid="create-lng"
                    {...form.register('longitude', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Créneaux</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      append({
                        start_at: '',
                        end_at: '',
                      })
                    }
                  >
                    Ajouter un créneau
                  </Button>
                </div>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`slot-start-${index}`}>Début</Label>
                        <Input
                          id={`slot-start-${index}`}
                          type="datetime-local"
                          data-testid={`slot-start-${index}`}
                          {...form.register(`slots.${index}.start_at`)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`slot-end-${index}`}>Fin</Label>
                        <Input
                          id={`slot-end-${index}`}
                          type="datetime-local"
                          data-testid={`slot-end-${index}`}
                          {...form.register(`slots.${index}.end_at`)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="col-span-full justify-start text-destructive"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        Supprimer
                      </Button>
                    </div>
                  ))}
                </div>
                {form.formState.errors.slots && (
                  <p className="text-sm text-destructive">{form.formState.errors.slots.message as string}</p>
                )}
              </div>
            </fieldset>

            <Button type="submit" className="w-full" disabled={creationLocked || isSubmitting}>
              {creationLocked
                ? 'Onboarding Stripe requis'
                : isSubmitting
                  ? 'Publication...'
                  : 'Publier'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default CreateRoute;
