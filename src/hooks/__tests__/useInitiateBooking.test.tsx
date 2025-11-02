import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useInitiateBooking } from '../useInitiateBooking';

const mutateAsyncMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('../useBookSlot', () => ({
  useBookSlot: () => ({
    mutateAsync: mutateAsyncMock,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe('useInitiateBooking', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    vi.stubEnv('VITE_FUNCTIONS_URL', 'https://functions.test');
    mutateAsyncMock.mockReset();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
    vi.unstubAllEnvs();
  });

  it('creates a payment intent, books a slot, and attaches the booking to the transfer', async () => {
    fetchMock
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ clientSecret: 'secret', paymentIntentId: 'pi_123' }),
      }))
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

    let bookingResult: { clientSecret: string; paymentIntentId: string } | undefined;

    await act(async () => {
      bookingResult = await result.current.mutateAsync({
        slotId: 'slot-123',
        customerEmail: 'user@example.com',
      });
    });

    expect(bookingResult).toEqual({ clientSecret: 'secret', paymentIntentId: 'pi_123' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://functions.test/create-payment-intent',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(mutateAsyncMock).toHaveBeenCalledWith({ slotId: 'slot-123', paymentIntentId: 'pi_123' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://functions.test/attach-booking-transfer',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    queryClient.clear();
  });

  it('handles errors when creating payment intent fails', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Failed to create payment intent' }),
    }));

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useInitiateBooking(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          slotId: 'slot-123',
          customerEmail: 'user@example.com',
        }),
      ).rejects.toThrow();
    });

    expect(mutateAsyncMock).not.toHaveBeenCalled();

    queryClient.clear();
  });
});
