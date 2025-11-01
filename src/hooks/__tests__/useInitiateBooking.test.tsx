import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const rpcMock = vi.fn();
const confirmCardPaymentMock = vi.fn();

vi.mock('@stripe/stripe-js', () => {
  return {
    loadStripe: vi.fn(() => Promise.resolve({ confirmCardPayment: confirmCardPaymentMock })),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

let useInitiateBooking: typeof import('../useInitiateBooking').useInitiateBooking;

describe('useInitiateBooking', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    (globalThis as unknown as { alert: typeof alert }).alert = vi.fn();
    confirmCardPaymentMock.mockReset();
    confirmCardPaymentMock.mockResolvedValue({ paymentIntent: { id: 'pi_123' } });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: 'booking-123', error: null });
    vi.stubEnv('VITE_FUNCTIONS_URL', 'https://functions.test');
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test');

    // ensure module picks up latest env values
    const module = await import('../useInitiateBooking');
    useInitiateBooking = module.useInitiateBooking;

  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
    delete (globalThis as { alert?: typeof alert }).alert;
    vi.unstubAllEnvs();
    confirmCardPaymentMock.mockReset();
  });

  it('creates a payment intent, books the slot, attaches the transfer and confirms the payment', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clientSecret: 'secret', paymentIntentId: 'pi_123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transferGroup: 'booking-123' }),
      });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useInitiateBooking(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        slotId: 'slot-123',
        customerEmail: 'user@example.com',
      });
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://functions.test/create-payment-intent',
      expect.objectContaining({ method: 'POST' }),
    );

    expect(rpcMock).toHaveBeenCalledWith('book_slot', {
      p_slot_id: 'slot-123',
      p_payment_intent_id: 'pi_123',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://functions.test/attach-booking-transfer',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    expect(confirmCardPaymentMock).toHaveBeenCalledWith('secret', {
      payment_method: 'pm_card_visa',
    });

    expect(window.alert).toHaveBeenCalledWith('Booking confirmed!');

    queryClient.clear();
  });
});
