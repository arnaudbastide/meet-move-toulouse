import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

const registerSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['vendor', 'user']),
});

type RegisterValues = z.infer<typeof registerSchema>;

const AuthRoute: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { refreshProfile } = useAuth();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'user', name: '', email: '', password: '' },
  });

  const handleRegister = async (values: RegisterValues) => {
    if (!values.name) {
      throw new Error('Le nom est requis');
    }
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;
    const user = data.user;
    if (!user) throw new Error('Inscription incomplète');
    const roleId = values.role === 'vendor' ? 1 : 2;
    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      name: values.name,
      role_id: roleId,
    });
    if (profileError) throw profileError;
    await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
    await refreshProfile();
  };

  const handleLogin = async (values: RegisterValues) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;
    await refreshProfile();
  };

  const onSubmit = async (values: RegisterValues) => {
    try {
      if (mode === 'register') {
        await handleRegister(values);
        toast.success('Compte créé, vérifiez votre email.');
      } else {
        await handleLogin(values);
        toast.success('Connexion réussie');
      }
    } catch (error: any) {
      toast.error(error.message ?? 'Erreur d\'authentification');
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{mode === 'register' ? 'Créer un compte' : 'Connexion'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant={mode === 'login' ? 'default' : 'outline'}
                data-testid="auth-switch-login"
                onClick={() => setMode('login')}
              >
                Se connecter
              </Button>
              <Button
                type="button"
                variant={mode === 'register' ? 'default' : 'outline'}
                data-testid="auth-switch-register"
                onClick={() => setMode('register')}
              >
                S'inscrire
              </Button>
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input id="name" data-testid="auth-name" {...form.register('name')} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" data-testid="auth-email" {...form.register('email')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" data-testid="auth-password" {...form.register('password')} />
            </div>

            {mode === 'register' && (
              <div className="space-y-3">
                <Label>Choisissez votre rôle</Label>
                <RadioGroup value={form.watch('role')} onValueChange={(value) => form.setValue('role', value as RegisterValues['role'])}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="user" id="role-user" />
                    <Label htmlFor="role-user">Utilisateur (réserve des activités)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="vendor" id="role-vendor" />
                    <Label htmlFor="role-vendor">Vendor (publie des activités)</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <Button type="submit" className="w-full" data-testid="auth-submit">
              {mode === 'register' ? 'Créer mon compte' : 'Connexion'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default AuthRoute;
