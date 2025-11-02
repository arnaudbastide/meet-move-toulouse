import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a price expressed in cents into a localized currency string.
 */
export function formatPrice(
  value: number | null | undefined,
  currency: string = "EUR",
) {
  const cents = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  const amount = cents / 100;

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Format an ISO date string into a human-friendly French date/time.
 */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date?.getTime?.())) {
    return "";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date as Date);
}

/**
 * Resolve the base URL for Supabase Edge Functions.
 */
export function getFunctionsBaseUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1`;
}
