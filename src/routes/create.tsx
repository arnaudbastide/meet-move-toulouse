import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription 
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const eventSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().min(1, 'La description est requise'),
  category: z.enum(['sport', 'culture', 'food', 'games', 'other'], {
    required_error: 'La catégorie est requise',
  }),
  price_cents: z.number().min(0, 'Le prix doit être positif'),
  max_places: z.number().min(1, 'Le nombre de places doit être au moins 1'),
  address: z.string().min(1, 'L\'adresse est requise'),
  lat: z.number().min(-90).max(90, 'La latitude doit être entre -90 et 90'),
  lng: z.number().min(-180).max(180, 'La longitude doit être entre -180 et 180'),
  slots: z.array(z.object({
    start_at: z.string().min(1, 'Date de début requise'),
    end_at: z.string().min(1, 'Date de fin requise'),
  })).min(1, 'Au moins un créneau est requis'),
}).refine(
  (data) => {
    // Check that all end dates are after start dates
    return data.slots.every((slot) => {
      if (!slot.start_at || !slot.end_at) return true;
      return new Date(slot.end_at) > new Date(slot.start_at);
    });
  },
  {
    message: 'La date de fin doit être après la date de début',
    path: ['slots'],
  }
);

const createEvent = async (values: z.infer<typeof eventSchema>) => {
  // Convert slots to ISO strings for RPC
  const slotsJson = values.slots.map(slot => ({
    start_at: new Date(slot.start_at).toISOString(),
    end_at: new Date(slot.end_at).toISOString(),
  }));

  const { data, error } = await supabase.rpc('create_event_with_slots', {
    p_title: values.title,
    p_desc: values.description,
    p_cat: values.category,
    p_price_cents: Math.round(values.price_cents),
    p_max: values.max_places,
    p_addr: values.address,
    p_lat: values.lat,
    p_lng: values.lng,
    p_slots: slotsJson,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

const CreateRoute = () => {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'sport',
      price_cents: 0,
      max_places: 10,
      address: '',
      lat: 43.6047, // Toulouse default
      lng: 1.4442,
      slots: [{ start_at: '', end_at: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'slots',
  });

  const { mutate: createEventMutation, isPending } = useMutation({
    mutationFn: createEvent,
    onSuccess: (eventId) => {
      toast.success('Événement créé avec succès !');
      navigate(`/event/${eventId}`);
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof eventSchema>) => {
    createEventMutation(values);
  };

  // Soft route guard: show friendly message if not vendor
  if (!authLoading && (!profile || profile.role_id !== 1)) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Accès restreint</CardTitle>
            <CardDescription>
              Cette page est réservée aux vendeurs. Devenez vendeur pour créer des événements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/auth">
              <Button className="w-full">Devenir vendeur</Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full">Retour à l'accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Créer un événement</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>Décrivez votre événement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Yoga Sunrise" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Session douce au lever du soleil"
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une catégorie" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sport">Sport</SelectItem>
                        <SelectItem value="culture">Culture</SelectItem>
                        <SelectItem value="food">Alimentation</SelectItem>
                        <SelectItem value="games">Jeux</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tarification et capacité</CardTitle>
              <CardDescription>Définissez le prix et le nombre de places</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="price_cents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix (en centimes d'euro)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        placeholder="1500"
                      />
                    </FormControl>
                    <FormDescription>
                      Ex: 1500 = 15,00 €
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_places"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de places maximum</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        min={1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Localisation</CardTitle>
              <CardDescription>Indiquez l'adresse et les coordonnées</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Toulouse - Prairie des Filtres" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any"
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          placeholder="43.6047"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lng"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="any"
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          placeholder="1.4442"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Créneaux horaires</CardTitle>
              <CardDescription>Ajoutez au moins un créneau pour votre événement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`slots.${index}.start_at`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date et heure de début</FormLabel>
                            <FormControl>
                              <Input 
                                type="datetime-local" 
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`slots.${index}.end_at`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date et heure de fin</FormLabel>
                            <FormControl>
                              <Input 
                                type="datetime-local" 
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {fields.length > 1 && (
                      <Button 
                        type="button" 
                        variant="destructive" 
                        onClick={() => remove(index)}
                        className="mt-8"
                      >
                        Supprimer
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => append({ start_at: '', end_at: '' })}
                className="w-full"
              >
                Ajouter un créneau
              </Button>
              {form.formState.errors.slots && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.slots.message}
                </p>
              )}
            </CardContent>
          </Card>

          <Button type="submit" disabled={isPending} className="w-full" size="lg">
            {isPending ? 'Création en cours...' : 'Créer l\'événement'}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default CreateRoute;
