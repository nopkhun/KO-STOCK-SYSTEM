-- Migrate 10 users directly into auth.users + public.profiles
-- Run this in Supabase Dashboard → SQL Editor
-- Passwords are set to KO@<username> (bcrypt hashed)
-- Users should change password after first login

DO $$
DECLARE
  v_users JSONB := '[
    {"username": "admin",   "role": "master", "must_change": false},
    {"username": "monchai", "role": "admin",  "must_change": false},
    {"username": "vivo",    "role": "admin",  "must_change": false},
    {"username": "mali",    "role": "admin",  "must_change": false},
    {"username": "ranran",  "role": "admin",  "must_change": false},
    {"username": "mssp",    "role": "admin",  "must_change": false},
    {"username": "apple",   "role": "admin",  "must_change": false},
    {"username": "kobkob",  "role": "admin",  "must_change": false},
    {"username": "aomaom",  "role": "admin",  "must_change": false},
    {"username": "koikoi",  "role": "master", "must_change": false}
  ]'::JSONB;
  v_user JSONB;
  v_id UUID;
  v_username TEXT;
  v_role TEXT;
  v_email TEXT;
  v_password TEXT;
  v_must_change BOOLEAN;
BEGIN
  FOR v_user IN SELECT * FROM jsonb_array_elements(v_users)
  LOOP
    v_username   := v_user->>'username';
    v_role       := v_user->>'role';
    v_must_change := (v_user->>'must_change')::boolean;
    v_email      := v_username || '@ko-stock.local';
    v_password   := 'KO@' || v_username;
    v_id         := gen_random_uuid();

    -- Skip if already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      RAISE NOTICE 'User % already exists, skipping', v_username;
      CONTINUE;
    END IF;

    -- Insert into auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      role,
      aud,
      created_at,
      updated_at,
      raw_user_meta_data,
      raw_app_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),           -- email already confirmed
      'authenticated',
      'authenticated',
      NOW(),
      NOW(),
      jsonb_build_object('username', v_username, 'role', v_role, 'must_change_password', v_must_change),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', v_role),
      false,
      '',
      '',
      '',
      ''
    );

    -- Insert into auth.identities (required for email login to work)
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_id,
      v_email,
      jsonb_build_object('sub', v_id::text, 'email', v_email),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    -- Insert into public.profiles
    INSERT INTO public.profiles (id, username, role, must_change_password)
    VALUES (v_id, v_username, v_role::user_role, v_must_change)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created user: % (%)', v_username, v_id;
  END LOOP;

  RAISE NOTICE 'Done!';
END $$;

-- Verify results
SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL as confirmed,
  p.username,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email LIKE '%@ko-stock.local'
ORDER BY u.created_at;
