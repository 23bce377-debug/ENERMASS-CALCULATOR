-- Fix circular dependency between auth_org_id() and profiles RLS policy
-- The auth_org_id() function queries profiles table, but profiles RLS policy uses auth_org_id()
-- This causes infinite recursion when auth_org_id() tries to read profiles
-- Solution: Allow users to read their own profile (id = auth.uid()) in addition to org isolation

BEGIN;

-- Drop and recreate the profiles RLS policy to allow self-read
DROP POLICY IF EXISTS "profiles_org_isolation" ON public.profiles;
CREATE POLICY "profiles_org_isolation" ON public.profiles
  USING (org_id = auth_org_id() OR id = auth.uid());

-- Also fix organisations policy for consistency (though it doesn't query profiles directly)
DROP POLICY IF EXISTS "org_isolation" ON public.organisations;
CREATE POLICY "org_isolation" ON public.organisations
  USING (id = auth_org_id() OR id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;