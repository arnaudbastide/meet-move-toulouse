import { EventSlot } from '@/lib/types';

interface SlotPickerProps {
  slots: EventSlot[];
  onSlotSelect: (slotId: string) => void;
}

const SlotPicker = ({ slots, onSlotSelect }: SlotPickerProps) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Available Slots</h3>
      <div className="flex flex-col gap-2">
        {slots.map((slot) => (
          <button
            key={slot.id}
            onClick={() => onSlotSelect(slot.id)}
            className="p-2 border rounded-md text-left hover:bg-secondary"
          >
            <p>{new Date(slot.start_at).toLocaleString()} - {new Date(slot.end_at).toLocaleString()}</p>
            <p>{slot.booked_places} / {10} booked</p> {/* Assuming max_places is on the event */}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SlotPicker;