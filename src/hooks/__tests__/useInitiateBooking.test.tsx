import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useInitiateBooking } from '../useInitiateBooking';
import { useBookSlot } from '../useBookSlot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('../useBookSlot', () => ({
  useBookSlot: vi.fn(),
}));

global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useInitiateBooking', () => {
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    (useBookSlot as vi.Mock).mockReturnValue({ mutateAsync: mockMutateAsync });
  });

  it('should handle successful booking initiation', async () => {
    // Arrange
    (fetch as vi.Mock)
      .mockResolvedValueOnce(new Response(JSON.stringify({ 
        clientSecret: 'test_client_secret', 
        paymentIntentId: 'pi_123' 
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    mockMutateAsync.mockResolvedValue('booking_456');

    const { result } = renderHook(() => useInitiateBooking(), { wrapper: createWrapper() });

    // Act
    result.current.mutate({ slotId: 'slot_123', customerEmail: 'test@example.com' });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/create-payment-intent'), expect.any(Object));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/attach-booking-transfer'), expect.any(Object));
    expect(mockMutateAsync).toHaveBeenCalledWith({ slotId: 'slot_123', paymentIntentId: 'pi_123' });
    expect(result.current.data).toEqual({ clientSecret: 'test_client_secret', paymentIntentId: 'pi_123' });
  });

  it('should handle payment intent creation failure', async () => {
    // Arrange
    (fetch as vi.Mock).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Failed' }), { status: 500 }));

    const { result } = renderHook(() => useInitiateBooking(), { wrapper: createWrapper() });

    // Act
    result.current.mutate({ slotId: 'slot_123', customerEmail: 'test@example.com' });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toContain('Failed to create payment intent');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('should handle booking creation failure', async () => {
    // Arrange
    (fetch as vi.Mock).mockResolvedValueOnce(new Response(JSON.stringify({ 
      clientSecret: 'test_client_secret', 
      paymentIntentId: 'pi_123' 
    }), { status: 200 }));

    mockMutateAsync.mockRejectedValue(new Error('Booking failed'));

    const { result } = renderHook(() => useInitiateBooking(), { wrapper: createWrapper() });

    // Act
    result.current.mutate({ slotId: 'slot_123', customerEmail: 'test@example.com' });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('Booking failed');
    expect(fetch).toHaveBeenCalledTimes(1); // Only payment intent call
  });

  it('should handle booking transfer attachment failure', async () => {
    // Arrange
    (fetch as vi.Mock)
      .mockResolvedValueOnce(new Response(JSON.stringify({ 
        clientSecret: 'test_client_secret', 
        paymentIntentId: 'pi_123' 
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Attach failed' }), { status: 500 }));

    mockMutateAsync.mockResolvedValue('booking_456');

    const { result } = renderHook(() => useInitiateBooking(), { wrapper: createWrapper() });

    // Act
    result.current.mutate({ slotId: 'slot_123', customerEmail: 'test@example.com' });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toContain('Failed to attach booking transfer');
  });
});