-- Allow master admins to update ERP structure material rates from the Structures master.
-- These rows are global rate drivers used by structure_templates and the calculator.

DROP POLICY IF EXISTS structure_material_rates_update ON public.structure_material_rates;

CREATE POLICY structure_material_rates_update
  ON public.structure_material_rates
  FOR UPDATE
  TO authenticated
  USING (public.is_superadmin() OR public.auth_role() IN ('owner', 'admin'))
  WITH CHECK (public.is_superadmin() OR public.auth_role() IN ('owner', 'admin'));
