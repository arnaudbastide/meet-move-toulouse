import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '../AuthContext';

const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const signOutMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signOut: signOutMock,
    },
    from: fromMock,
    rpc: rpcMock,
  },
}));

describe('AuthContext', () => {
  const profileResponse = { data: { id: 'user-123', role_id: 2 }, error: null };
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const session = { user: { id: 'user-123' } } as unknown as Session;

    getSessionMock.mockResolvedValue({ data: { session } });

    onAuthStateChangeMock.mockImplementation(() => ({
      data: {
        subscription: {
          unsubscribe,
        },
      },
    }));

    fromMock.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue(profileResponse),
        })),
      })),
    });

    rpcMock.mockResolvedValue({ data: false, error: null });
  });

  it('reports loading=false once profile and role checks finish', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(rpcMock).toHaveBeenCalledWith('has_role', {
      _role: 'admin',
      _user_id: 'user-123',
    });
  });
});
