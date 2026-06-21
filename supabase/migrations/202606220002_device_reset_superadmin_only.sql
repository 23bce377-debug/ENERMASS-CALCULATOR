-- Tighten device reset: only super admin (not org admin) can approve resets.
-- Org admin retains read access for visibility.

BEGIN;

-- Remove org admin's ability to approve/reject device resets
DROP POLICY IF EXISTS device_reset_requests_org_admin_review ON public.device_reset_requests;

-- Replace with super admin only policy
CREATE POLICY device_reset_requests_superadmin_review
  ON public.device_reset_requests FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

COMMIT;
