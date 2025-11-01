-- Enable RLS on roles table (it's read-only but needs RLS enabled)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles viewable by everyone"
  ON public.roles FOR SELECT
  USING (true);