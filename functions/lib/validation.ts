import { z } from 'zod';

export const createAccountLinkSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  refreshUrl: z.string().url('refreshUrl must be a valid URL'),
  returnUrl: z.string().url('returnUrl must be a valid URL'),
  email: z.string().email('email must be valid').optional(),
});

export const createPaymentIntentSchema = z.object({
  slotId: z.string().min(1, 'slotId is required'),
  customerEmail: z.string().email('customerEmail must be valid').optional(),
});

export const attachBookingTransferSchema = z.object({
  paymentIntentId: z.string().min(1, 'paymentIntentId is required'),
  bookingId: z.string().min(1, 'bookingId is required'),
});
