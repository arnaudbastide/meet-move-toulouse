import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface User {
  id: string;
  email?: string;
}

export async function getUserFromRequest(
  req: Request,
  supabase: SupabaseClient
): Promise<User | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
    };
  } catch {
    return null;
  }
}
