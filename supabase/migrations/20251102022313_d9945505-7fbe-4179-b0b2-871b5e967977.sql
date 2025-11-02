-- Fix security issue: Restrict profiles table to authenticated users only
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Fix security issue: Enable RLS on roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy first
DROP POLICY IF EXISTS "Roles viewable by everyone" ON roles;

-- Recreate with correct permissions
CREATE POLICY "Roles viewable by everyone"
  ON roles FOR SELECT
  USING (true);

-- Prevent direct modifications (only migrations can modify)
CREATE POLICY "No direct modifications to roles"
  ON roles FOR ALL
  USING (false)
  WITH CHECK (false);