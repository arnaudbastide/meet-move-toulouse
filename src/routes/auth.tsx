import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const AuthRoute = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user'); // 'user' or 'vendor'
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
          },
        },
      });
      if (error) alert(error.message);
    }
  };

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
        <Button onClick={handleAuth} className="w-full">
          {isLogin ? 'Login' : 'Sign Up'}
        </Button>
        <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="w-full">
          {isLogin ? 'Need an account? Sign up' : 'Have an account? Login'}
        </Button>
      </div>
    </div>
  );
};

export default AuthRoute;
