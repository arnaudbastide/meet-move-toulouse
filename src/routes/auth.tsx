import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL ?? 'http://localhost:8787';

const AuthRoute = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user'); // 'user' or 'vendor'
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const ensureProfile = async (accessToken: string, selectedRole: string, displayName: string) => {
    try {
      await fetch(`${FUNCTIONS_URL}/ensure-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          role: selectedRole,
          name: displayName,
        }),
      });
    } catch (error) {
      console.error('Failed to ensure profile after auth', error);
    }
  };

  const handleRedirectByRole = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSession = sessionData.session;

    if (!currentSession?.user) {
      navigate('/', { replace: true });
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', currentSession.user.id)
      .maybeSingle();

    let roleId = profileData?.role_id ?? null;
    const metadataRole = (currentSession.user.user_metadata?.role as string | undefined)?.toLowerCase() ?? 'user';
    const displayName =
      (currentSession.user.user_metadata?.name as string | undefined) ??
      (currentSession.user.user_metadata?.full_name as string | undefined) ??
      currentSession.user.email?.split('@')[0] ??
      'Member';

    if (!roleId && currentSession.access_token) {
      await ensureProfile(currentSession.access_token, metadataRole, displayName);
      roleId = metadataRole === 'vendor' ? 1 : metadataRole === 'admin' ? 99 : 2;
    }

    if (roleId === 1) {
      navigate('/vendor-dashboard', { replace: true });
      return;
    }

    navigate('/bookings', { replace: true });
  };

  const handleAuth = async () => {
    if (!email || !password) {
      toast.error('Please provide both email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Welcome back!');
          if (data.session?.access_token) {
            const displayName =
              (data.session.user.user_metadata?.name as string | undefined) ??
              (data.session.user.user_metadata?.full_name as string | undefined) ??
              email.split('@')[0] ??
              'Member';
            await ensureProfile(
              data.session.access_token,
              (data.session.user.user_metadata?.role as string | undefined)?.toLowerCase() ?? 'user',
              displayName,
            );
          }
          await handleRedirectByRole();
        }
      } else {
        const fallbackName = email.split('@')[0] ?? 'Member';
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role,
              name: fallbackName,
              full_name: fallbackName,
            },
          },
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Check your inbox to confirm your email.');
          if (data.session?.access_token) {
            await ensureProfile(data.session.access_token, role, fallbackName);
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-sm">
      <h1 className="text-2xl font-bold mb-4">{isLogin ? 'Login' : 'Sign Up'}</h1>
      <div className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {!isLogin && (
          <RadioGroup defaultValue="user" onValueChange={setRole}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="user" id="user" />
              <Label htmlFor="user">User</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="vendor" id="vendor" />
              <Label htmlFor="vendor">Vendor</Label>
            </div>
          </RadioGroup>
        )}
        <Button onClick={handleAuth} className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Please wait...' : isLogin ? 'Login' : 'Sign Up'}
        </Button>
        <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="w-full">
          {isLogin ? 'Need an account? Sign up' : 'Have an account? Login'}
        </Button>
      </div>
    </div>
  );
};

export default AuthRoute;
