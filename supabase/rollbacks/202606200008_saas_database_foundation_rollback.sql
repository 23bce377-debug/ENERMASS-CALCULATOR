-- Rollback for 202606200008_saas_database_foundation.sql.
-- This removes the SaaS foundation tables and SaaS-only helper functions.
-- It intentionally does not drop auth_org_id(), auth_role(), current_org_id(), or user_role()
-- because earlier migrations and application code depend on those helpers.

BEGIN;

DROP TABLE IF EXISTS public.license_events CASCADE;
DROP TABLE IF EXISTS public.subscription_payments CASCADE;
DROP TABLE IF EXISTS public.device_reset_requests CASCADE;
DROP TABLE IF EXISTS public.device_sessions CASCADE;
DROP TABLE IF EXISTS public.user_devices CASCADE;
DROP TABLE IF EXISTS public.org_members CASCADE;
DROP TABLE IF EXISTS public.org_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;

DROP FUNCTION IF EXISTS public.saas_validate_session_device_org() CASCADE;
DROP FUNCTION IF EXISTS public.saas_enforce_subscription_plan_seat_limit() CASCADE;
DROP FUNCTION IF EXISTS public.saas_enforce_org_subscription_seat_limit() CASCADE;
DROP FUNCTION IF EXISTS public.saas_set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_superadmin() CASCADE;
DROP FUNCTION IF EXISTS public.is_service_role() CASCADE;

COMMIT;
