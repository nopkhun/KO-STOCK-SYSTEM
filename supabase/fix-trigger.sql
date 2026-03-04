-- Run this in Supabase SQL Editor to fix the trigger
-- The original trigger fails because casting JSON text to user_role enum can error
-- This version handles the cast safely with a CASE statement

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_role user_role;
  v_must_change BOOLEAN;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1),
    'user'
  );

  v_role := CASE (NEW.raw_user_meta_data->>'role')
    WHEN 'master' THEN 'master'::user_role
    WHEN 'admin'  THEN 'admin'::user_role
    ELSE 'viewer'::user_role
  END;

  v_must_change := COALESCE(
    (NEW.raw_user_meta_data->>'must_change_password')::boolean,
    false
  );

  INSERT INTO profiles (id, username, role, must_change_password)
  VALUES (NEW.id, v_username, v_role, v_must_change)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
