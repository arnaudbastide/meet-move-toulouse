import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  role_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
} | null;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
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

    syncSession();

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

    if (user) {
      const fetchProfile = async () => {
        setLoading(true);

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (!isMounted) {
            return;
          }

          if (error) {
            console.error('Failed to load profile', error);
            setProfile(null);
          } else {
            setProfile(data ?? null);
          }
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

      void fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

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
