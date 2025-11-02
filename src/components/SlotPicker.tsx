import { EventSlot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SlotPickerProps {
  slots: EventSlot[];
  onSlotSelect: (slotId: string) => void;
  maxPlaces?: number;
  disabled?: boolean;
}

const SlotPicker = ({
  slots,
  onSlotSelect,
  maxPlaces = 0,
  disabled = false,
}: SlotPickerProps) => {
  const formatDateTime = (iso: string) => {
    try {
      return format(new Date(iso), "PPpp", { locale: fr });
    } catch {
      return iso;
    }
  };

  const isSlotFull = (slot: EventSlot) => {
    return maxPlaces > 0 && slot.booked_places >= maxPlaces;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créneaux disponibles</CardTitle>
        <CardDescription>Sélectionnez un créneau pour réserver</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {slots.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Aucun créneau disponible.
            </p>
          ) : (
            slots.map((slot) => {
              const full = isSlotFull(slot);
              const available =
                maxPlaces > 0 ? maxPlaces - slot.booked_places : 0;

              return (
                <Card key={slot.id} className={full ? "opacity-50" : ""}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">
                          {formatDateTime(slot.start_at)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          jusqu'à{" "}
                          {format(new Date(slot.end_at), "HH:mm", {
                            locale: fr,
                          })}
                        </p>
                      </div>
                      {maxPlaces > 0 && (
                        <div className="text-right text-sm">
                          <p
                            className={
                              full
                                ? "text-destructive font-semibold"
                                : "text-muted-foreground"
                            }
                          >
                            {full
                              ? "Complet"
                              : `${available} place${
                                  available > 1 ? "s" : ""
                                } disponible${available > 1 ? "s" : ""}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {slot.booked_places} / {maxPlaces} réservé
                            {slot.booked_places > 1 ? "s" : ""}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => onSlotSelect(slot.id)}
                      disabled={disabled || full}
                      className="w-full"
                      variant={full ? "secondary" : "default"}
                    >
                      {full ? "Complet" : "Payer & réserver"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SlotPicker;
