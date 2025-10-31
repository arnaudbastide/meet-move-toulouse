import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { EventSlot } from '@/lib/supabase';

interface SlotPickerProps {
  slots: EventSlot[];
  selected?: string;
  onChange: (slotId: string) => void;
}

export const SlotPicker: React.FC<SlotPickerProps> = ({ slots, selected, onChange }) => {
  if (!slots.length) {
    return <p className="text-sm text-muted-foreground">Aucun créneau disponible.</p>;
  }

  return (
    <RadioGroup value={selected} onValueChange={onChange} className="space-y-3">
      {slots.map((slot) => {
        const start = format(new Date(slot.start_at), 'PPPPp', { locale: fr });
        const end = format(new Date(slot.end_at), 'p', { locale: fr });
        const remaining = Math.max(slot.booked_places, 0);
        return (
          <div
            key={slot.id}
            className="flex items-center justify-between rounded-md border p-3 hover:border-primary"
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value={slot.id} id={slot.id} />
              <Label htmlFor={slot.id} className="cursor-pointer">
                <div className="font-medium">{start}</div>
                <div className="text-sm text-muted-foreground">Fin à {end}</div>
              </Label>
            </div>
            <span className="text-sm text-muted-foreground">{remaining} réservations</span>
          </div>
        );
      })}
    </RadioGroup>
  );
};
