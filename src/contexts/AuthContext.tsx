import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isVendor: boolean;
  isUser: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      setProfile(data ?? null);
    } catch (error) {
      console.error('Failed to load profile', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await fetchProfile(data.session.user.id);
      } else {
        setProfileLoading(false);
        setIsAdmin(false);
        setRoleLoading(false);
      }
    };

    void getInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void fetchProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setProfileLoading(false);
        setIsAdmin(false);
        setRoleLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [fetchProfile, user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsAdmin(false);
    setRoleLoading(false);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);

      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin',
        });

        if (cancelled) {
          return;
        }

        if (error) {
          console.error('Failed to verify admin role', error);
          setIsAdmin(false);
          return;
        }

        setIsAdmin(Boolean(data));
      } catch (rpcError) {
        if (!cancelled) {
          console.error('Unexpected error while verifying admin role', rpcError);
          setIsAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setRoleLoading(false);
        }
      }
    };

    void checkAdminRole();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(() => {
    const isVendor = profile?.role_id === 1;
    const isUser = profile?.role_id === 2;
    const loading = profileLoading || roleLoading;

    return {
      session,
      user,
      profile,
      loading,
      isVendor,
      isUser,
      isAdmin,
      refreshProfile,
      signOut,
    };
  }, [
    session,
    user,
    profile,
    profileLoading,
    roleLoading,
    refreshProfile,
    signOut,
    isAdmin,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
