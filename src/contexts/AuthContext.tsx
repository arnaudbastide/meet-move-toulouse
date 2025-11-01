import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type ProfileRow = {
  id: string;
  role_id?: number | null;
  name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
} | null;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: ProfileRow;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL ?? 'http://localhost:8787';

type RoleKey = 'vendor' | 'user' | 'admin';

const deriveRoleKey = (user: User): RoleKey => {
  const metadataRole = (user.user_metadata?.role as string | undefined)?.toLowerCase();
  if (metadataRole === 'vendor') {
    return 'vendor';
  }
  if (metadataRole === 'admin') {
    return 'admin';
  }
  return 'user';
};

const deriveRoleId = (user: User): number => {
  const roleKey = deriveRoleKey(user);
  if (roleKey === 'vendor') return 1;
  if (roleKey === 'admin') return 99;
  return 2;
};

const deriveDisplayName = (user: User): string => {
  const metadata = user.user_metadata ?? {};
  const raw =
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    user.email?.split('@')[0] ??
    'Community member';
  return raw.trim() || 'Community member';
};

const buildProfilePayload = (user: User) => {
  const displayName = deriveDisplayName(user);
  return {
    id: user.id,
    role_id: deriveRoleId(user),
    name: displayName,
    full_name: displayName,
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  };
};

const ensureProfileExists = async (
  session: Session | null,
  user: User,
  current: ProfileRow,
): Promise<ProfileRow> => {
  if (current?.role_id) {
    return current;
  }

  if (!session?.access_token) {
    return current;
  }

  try {
    const roleKey = deriveRoleKey(user);
    const displayName = buildProfilePayload(user).name ?? 'Community member';
    const response = await fetch(`${FUNCTIONS_URL}/ensure-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        role: roleKey,
        name: displayName,
      }),
    });

    if (!response.ok) {
      console.error('Failed to ensure profile via service endpoint', await response.text());
      return current;
    }

    const payload = (await response.json()) as { profile?: ProfileRow };
    return payload.profile ?? current;
  } catch (error) {
    console.error('Unexpected error while ensuring profile exists', error);
    return current;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) {
          return;
        }

        setSession(data.session);
        setUser(data.session?.user ?? null);

        if (!data.session?.user) {
          setProfile(null);
          setLoading(false);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to retrieve auth session', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    void syncSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async (currentUser: User, currentSession: Session | null) => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error('Failed to load profile', error);
          setProfile(null);
          setLoading(false);
          return;
        }

        const ensured = await ensureProfileExists(currentSession, currentUser, data ?? null);
        if (!isMounted) {
          return;
        }

        setProfile(ensured ?? null);
      } catch (error) {
        if (isMounted) {
          console.error('Unexpected profile fetch error', error);
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (user) {
      void loadProfile(user, session);
    } else {
      setProfile(null);
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user, session]);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
