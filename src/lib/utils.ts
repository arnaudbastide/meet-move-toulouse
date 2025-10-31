import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatPrice = (cents: number, currency = 'EUR') => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format((cents ?? 0) / 100);
};

export const formatDateTime = (iso: string) => {
  try {
    return format(new Date(iso), 'PPpp');
  } catch (error) {
    return iso;
  }
};

export const extractLatLng = (geom: unknown): { lat: number; lng: number } | null => {
  if (!geom) return null;
  if (typeof geom === 'string') {
    try {
      const parsed = JSON.parse(geom);
      if (parsed?.coordinates?.length === 2) {
        return { lat: parsed.coordinates[1], lng: parsed.coordinates[0] };
      }
    } catch {
      return null;
    }
  }
  if (typeof geom === 'object' && geom !== null && 'coordinates' in geom) {
    const coords = (geom as { coordinates: [number, number] }).coordinates;
    if (coords?.length === 2) {
      return { lat: coords[1], lng: coords[0] };
    }
  }
  return null;
};
