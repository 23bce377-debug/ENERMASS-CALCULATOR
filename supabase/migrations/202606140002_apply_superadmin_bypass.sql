-- Migration: 202606140002_apply_superadmin_bypass.sql

DO $$
DECLARE
  t record;
  policy_name text := 'Superadmin full access bypass';
BEGIN
  FOR t IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    -- Enable RLS just in case it isn't (we saw it is on most tables already)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);

    -- Drop the policy if it exists to avoid errors
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t.tablename);
    
    -- Create the superadmin bypass policy
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.user_role() = ''superadmin'');',
      policy_name,
      t.tablename
    );
  END LOOP;
END;
$$;
