-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY,
  name TEXT UNIQUE CHECK (name IN ('vendor', 'user'))
);

-- Insert default roles
INSERT INTO roles (id, name) VALUES (1, 'vendor'), (2, 'user')
ON CONFLICT (id) DO NOTHING;

-- Add role_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role_id INT REFERENCES roles(id);

-- Update existing profiles to default to user role (2)
UPDATE profiles 
SET role_id = 2 
WHERE role_id IS NULL;

-- Make role_id NOT NULL with default
ALTER TABLE profiles 
ALTER COLUMN role_id SET DEFAULT 2,
ALTER COLUMN role_id SET NOT NULL;

-- Create trigger to auto-create profile with role from metadata
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_role_id INT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  SELECT id INTO v_role_id FROM roles WHERE name = v_role;
  
  -- Default to user role if role not found
  IF v_role_id IS NULL THEN
    v_role_id := 2; -- user role
  END IF;

  INSERT INTO public.profiles (id, full_name, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User'),
    v_role_id
  )
  ON CONFLICT (id) DO UPDATE
  SET role_id = v_role_id
  WHERE profiles.role_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_for_new_user();

