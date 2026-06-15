-- Migration: 202606140001_bulletproof_rba_claims.sql
-- Goal: Enforce Bulletproof RBA via Custom JWT Claims

-- 1. Create a function to set custom claims in auth.users securely
CREATE OR REPLACE FUNCTION public.set_claim(uid uuid, claim text, value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(claim, value)
  WHERE id = uid;
END;
$$;

-- 2. Create the trigger function to sync profile role/org_id to JWT claims
CREATE OR REPLACE FUNCTION public.on_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a profile is inserted or its role/org_id is updated, inject into JWT Claims
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.role IS DISTINCT FROM NEW.role OR OLD.org_id IS DISTINCT FROM NEW.org_id)) THEN
    PERFORM public.set_claim(NEW.id, 'user_role', to_jsonb(NEW.role));
    PERFORM public.set_claim(NEW.id, 'org_id', to_jsonb(NEW.org_id));
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach the trigger to public.profiles
DROP TRIGGER IF EXISTS on_profile_role_update_trigger ON public.profiles;
CREATE TRIGGER on_profile_role_update_trigger
  AFTER INSERT OR UPDATE OF role, org_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_profile_role_update();

-- 4. Elevate hrushibhanvadiya@gmail.com to superadmin
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find the user ID based on email
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'hrushibhanvadiya@gmail.com';
  
  IF target_user_id IS NOT NULL THEN
    -- This will fire the trigger and update the JWT claim automatically
    UPDATE public.profiles
    SET role = 'superadmin'
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- 5. Backfill all existing profiles into auth.users claims (so existing sessions don't break)
DO $$
DECLARE
  prof record;
BEGIN
  FOR prof IN SELECT id, role, org_id FROM public.profiles LOOP
    PERFORM public.set_claim(prof.id, 'user_role', to_jsonb(prof.role));
    PERFORM public.set_claim(prof.id, 'org_id', to_jsonb(prof.org_id));
  END LOOP;
END;
$$;

-- Helper function for RLS policies to read the claim natively in PG
CREATE OR REPLACE FUNCTION public.user_role() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', '')::text;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.user_org_id() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')::text;
$$ LANGUAGE sql STABLE;
