import { ControllerRenderProps } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/lib/utils';

interface PriceFieldProps {
  field: ControllerRenderProps<any, string>;
  currency?: string;
}

export const PriceField: React.FC<PriceFieldProps> = ({ field, currency = 'EUR' }) => {
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
};
