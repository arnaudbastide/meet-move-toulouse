import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useInitiateBooking } from '../useInitiateBooking';

const mutateAsyncMock = vi.fn();

vi.mock('../useBookSlot', () => ({
  useBookSlot: () => ({
    mutateAsync: mutateAsyncMock,
  }),
}));

describe('useInitiateBooking', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    vi.stubEnv('VITE_FUNCTIONS_URL', 'https://functions.test');
    mutateAsyncMock.mockReset();
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
    vi.unstubAllEnvs();
  });

  it('creates a payment intent before booking a slot and attaches the booking to the transfer', async () => {
    let resolveCreatePaymentIntent:
      | ((value: { ok: boolean; json: () => Promise<unknown> }) => void)
      | undefined;

    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCreatePaymentIntent = resolve;
          }),
      )
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ transferGroup: 'booking-id' }),
      }));

    mutateAsyncMock.mockResolvedValue('booking-id');

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useInitiateBooking(), { wrapper });

    let bookingPromise: Promise<{ clientSecret: string; paymentIntentId: string }> | undefined;

    await act(async () => {
      bookingPromise = result.current.mutateAsync({
        slotId: 'slot-123',
        customerEmail: 'user@example.com',
      });
    });

    expect(fetchMock).toHaveBeenCalledWith('https://functions.test/create-payment-intent', expect.any(Object));
    expect(mutateAsyncMock).not.toHaveBeenCalled();

    expect(resolveCreatePaymentIntent).toBeDefined();

    await act(async () => {
      resolveCreatePaymentIntent!({
        ok: true,
        json: async () => ({ clientSecret: 'secret', paymentIntentId: 'pi_123' }),
      });
      const resolved = await bookingPromise!;
      expect(resolved).toEqual({ clientSecret: 'secret', paymentIntentId: 'pi_123' });
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith({ slotId: 'slot-123', paymentIntentId: 'pi_123' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://functions.test/attach-booking-transfer',
      expect.objectContaining({ method: 'POST' }),
    );

    queryClient.clear();
  });
});
