import type { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/lib/utils';

interface PriceFieldProps<TFieldValues extends FieldValues> {
  field: ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>;
  currency?: string;
}

export function PriceField<TFieldValues extends FieldValues>({
  field,
  currency = 'EUR',
}: PriceFieldProps<TFieldValues>) {
  const cents = Number(field.value ?? 0);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Tarif</label>
      <Input
        type="number"
        min={0}
        step={1}
        value={cents}
        onChange={(event) => field.onChange(Number(event.target.value))}
      />
      <p className="text-xs text-muted-foreground">{formatPrice(cents, currency)}</p>
    </div>
  );
}
