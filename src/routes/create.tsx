import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  price_cents: z.number().min(0, 'Price must be positive'),
  max_places: z.number().min(1, 'Max places must be at least 1'),
  address: z.string().min(1, 'Address is required'),
  slots: z.array(z.object({
    start_at: z.string(),
    end_at: z.string(),
  })).min(1, 'At least one slot is required'),
});

const createEvent = async (values: z.infer<typeof eventSchema>) => {
  const { data, error } = await supabase.rpc('create_event_with_slots', {
    p_title: values.title,
    p_desc: values.description,
    p_cat: values.category,
    p_price_cents: values.price_cents,
    p_max: values.max_places,
    p_addr: values.address,
    p_lat: 43.6047, // Placeholder
    p_lng: 1.4442, // Placeholder
    p_slots: values.slots,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

const CreateRoute = () => {
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      price_cents: 0,
      max_places: 1,
      slots: [{ start_at: '', end_at: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'slots',
  });

  const { mutate: createEventMutation, isPending } = useMutation({
    mutationFn: createEvent,
    onSuccess: (data) => {
      navigate(`/event/${data}`);
    },
    onError: (error) => {
      alert(`Failed to create event: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof eventSchema>) => {
    createEventMutation(values);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Create Event</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Add other fields similarly */}

          <div>
            <h3 className="text-lg font-semibold">Slots</h3>
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-4 items-center">
                <FormField
                  control={form.control}
                  name={`slots.${index}.start_at`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
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
                      <FormLabel>End</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="destructive" onClick={() => remove(index)}>Remove</Button>
              </div>
            ))}
            <Button type="button" onClick={() => append({ start_at: '', end_at: '' })}>Add Slot</Button>
          </div>

          <Button type="submit" disabled={isPending}>{isPending ? 'Creating...' : 'Create Event'}</Button>
        </form>
      </Form>
    </div>
  );
};

export default CreateRoute;
