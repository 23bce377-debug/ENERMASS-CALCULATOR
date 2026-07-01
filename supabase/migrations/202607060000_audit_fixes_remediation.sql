-- Migration: 202607060000_audit_fixes_remediation.sql
-- Goal: Fix database schema issues, security RLS, unique constraints, and triggers.

BEGIN;

-- ─── 1. Re-declare auth_org_id() and auth_role() ───
CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id', '')::uuid,
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'user_role', ''),
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    'authenticated'
  );
$$;

-- ─── 2. Enable RLS and define policies for state, scheme, and terms tables ───
ALTER TABLE public.state_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_scheme_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_terms_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS state_rules_select ON public.state_rules;
DROP POLICY IF EXISTS state_rules_write ON public.state_rules;
DROP POLICY IF EXISTS calculation_schemes_select ON public.calculation_schemes;
DROP POLICY IF EXISTS calculation_schemes_write ON public.calculation_schemes;
DROP POLICY IF EXISTS scheme_slabs_select ON public.scheme_slabs;
DROP POLICY IF EXISTS scheme_slabs_write ON public.scheme_slabs;
DROP POLICY IF EXISTS state_scheme_overrides_select ON public.state_scheme_overrides;
DROP POLICY IF EXISTS state_scheme_overrides_write ON public.state_scheme_overrides;
DROP POLICY IF EXISTS state_terms_templates_select ON public.state_terms_templates;
DROP POLICY IF EXISTS state_terms_templates_write ON public.state_terms_templates;

CREATE POLICY state_rules_select ON public.state_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY calculation_schemes_select ON public.calculation_schemes FOR SELECT TO authenticated USING (true);
CREATE POLICY scheme_slabs_select ON public.scheme_slabs FOR SELECT TO authenticated USING (true);
CREATE POLICY state_scheme_overrides_select ON public.state_scheme_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY state_terms_templates_select ON public.state_terms_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY state_rules_write ON public.state_rules FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY calculation_schemes_write ON public.calculation_schemes FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY scheme_slabs_write ON public.scheme_slabs FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY state_scheme_overrides_write ON public.state_scheme_overrides FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY state_terms_templates_write ON public.state_terms_templates FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ─── 3. Add RLS policies for structure weight lookup & mounting structures ───
ALTER TABLE public.eq_mounting_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structure_weight_lookup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eq_mounting_structures_select ON public.eq_mounting_structures;
DROP POLICY IF EXISTS eq_mounting_structures_write ON public.eq_mounting_structures;
DROP POLICY IF EXISTS eq_mounting_structures_access ON public.eq_mounting_structures;
DROP POLICY IF EXISTS structure_weight_lookup_select ON public.structure_weight_lookup;
DROP POLICY IF EXISTS structure_weight_lookup_write ON public.structure_weight_lookup;

CREATE POLICY eq_mounting_structures_select ON public.eq_mounting_structures FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = public.auth_org_id());
CREATE POLICY eq_mounting_structures_write ON public.eq_mounting_structures FOR ALL TO authenticated
  USING (org_id = public.auth_org_id() OR public.is_superadmin())
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

CREATE POLICY structure_weight_lookup_select ON public.structure_weight_lookup FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.eq_mounting_structures s
      WHERE s.id = structure_weight_lookup.structure_id
        AND (s.org_id IS NULL OR s.org_id = public.auth_org_id())
    )
  );
CREATE POLICY structure_weight_lookup_write ON public.structure_weight_lookup FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.eq_mounting_structures s
      WHERE s.id = structure_weight_lookup.structure_id
        AND (s.org_id = public.auth_org_id() OR public.is_superadmin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.eq_mounting_structures s
      WHERE s.id = structure_weight_lookup.structure_id
        AND (s.org_id = public.auth_org_id() OR public.is_superadmin())
    )
  );

-- ─── 4. Re-declare write policies on equipment tables ───
DROP POLICY IF EXISTS eq_panels_select ON public.eq_panels;
DROP POLICY IF EXISTS eq_panels_write ON public.eq_panels;
DROP POLICY IF EXISTS eq_panels_access ON public.eq_panels;
DROP POLICY IF EXISTS eq_panels_visibility ON public.eq_panels;
CREATE POLICY eq_panels_select ON public.eq_panels FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = public.auth_org_id());
CREATE POLICY eq_panels_write ON public.eq_panels FOR ALL TO authenticated
  USING (org_id = public.auth_org_id() OR public.is_superadmin())
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS eq_inverters_select ON public.eq_inverters;
DROP POLICY IF EXISTS eq_inverters_write ON public.eq_inverters;
DROP POLICY IF EXISTS eq_inverters_access ON public.eq_inverters;
DROP POLICY IF EXISTS eq_inverters_visibility ON public.eq_inverters;
CREATE POLICY eq_inverters_select ON public.eq_inverters FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = public.auth_org_id());
CREATE POLICY eq_inverters_write ON public.eq_inverters FOR ALL TO authenticated
  USING (org_id = public.auth_org_id() OR public.is_superadmin())
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS eq_batteries_select ON public.eq_batteries;
DROP POLICY IF EXISTS eq_batteries_write ON public.eq_batteries;
DROP POLICY IF EXISTS eq_batteries_access ON public.eq_batteries;
DROP POLICY IF EXISTS eq_batteries_visibility ON public.eq_batteries;
CREATE POLICY eq_batteries_select ON public.eq_batteries FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = public.auth_org_id());
CREATE POLICY eq_batteries_write ON public.eq_batteries FOR ALL TO authenticated
  USING (org_id = public.auth_org_id() OR public.is_superadmin())
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS eq_meters_select ON public.eq_meters;
DROP POLICY IF EXISTS eq_meters_write ON public.eq_meters;
DROP POLICY IF EXISTS eq_meters_access ON public.eq_meters;
CREATE POLICY eq_meters_select ON public.eq_meters FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = public.auth_org_id());
CREATE POLICY eq_meters_write ON public.eq_meters FOR ALL TO authenticated
  USING (org_id = public.auth_org_id() OR public.is_superadmin())
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS eq_lightning_arresters_select ON public.eq_lightning_arresters;
DROP POLICY IF EXISTS eq_lightning_arresters_write ON public.eq_lightning_arresters;
DROP POLICY IF EXISTS eq_lightning_arresters_access ON public.eq_lightning_arresters;
CREATE POLICY eq_lightning_arresters_select ON public.eq_lightning_arresters FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = public.auth_org_id());
CREATE POLICY eq_lightning_arresters_write ON public.eq_lightning_arresters FOR ALL TO authenticated
  USING (org_id = public.auth_org_id() OR public.is_superadmin())
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

-- ─── 5. Update structure_component_master RLS write policy ───
DROP POLICY IF EXISTS structure_component_master_visibility ON public.structure_component_master;
DROP POLICY IF EXISTS structure_component_master_write ON public.structure_component_master;
CREATE POLICY structure_component_master_select ON public.structure_component_master FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = public.auth_org_id());
CREATE POLICY structure_component_master_write ON public.structure_component_master FOR ALL TO authenticated
  USING (org_id = public.auth_org_id() OR public.is_superadmin())
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

-- ─── 6. Recreate unique constraints incorporating org_id ───
ALTER TABLE public.eq_panels DROP CONSTRAINT IF EXISTS uq_panel;
DROP INDEX IF EXISTS public.uq_panel_org_idx;
CREATE UNIQUE INDEX uq_panel_org_idx ON public.eq_panels (brand, model, wattage_w, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.eq_inverters DROP CONSTRAINT IF EXISTS uq_inverter;
DROP INDEX IF EXISTS public.uq_inverter_org_idx;
CREATE UNIQUE INDEX uq_inverter_org_idx ON public.eq_inverters (brand, model, capacity_kw, inverter_type, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.eq_batteries DROP CONSTRAINT IF EXISTS uq_battery;
DROP INDEX IF EXISTS public.uq_battery_org_idx;
CREATE UNIQUE INDEX uq_battery_org_idx ON public.eq_batteries (brand, model, capacity_kwh, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ─── 7. Polymorphic check trigger on quote_items ───
CREATE OR REPLACE FUNCTION public.validate_quote_item_source()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source_item_id IS NULL OR NEW.source_table IS NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.source_table
    WHEN 'eq_panels' THEN
      IF NOT EXISTS (SELECT 1 FROM public.eq_panels WHERE id = NEW.source_item_id) THEN
        RAISE EXCEPTION 'Invalid source_item_id % for table eq_panels', NEW.source_item_id;
      END IF;
    WHEN 'eq_inverters' THEN
      IF NOT EXISTS (SELECT 1 FROM public.eq_inverters WHERE id = NEW.source_item_id) THEN
        RAISE EXCEPTION 'Invalid source_item_id % for table eq_inverters', NEW.source_item_id;
      END IF;
    WHEN 'eq_batteries' THEN
      IF NOT EXISTS (SELECT 1 FROM public.eq_batteries WHERE id = NEW.source_item_id) THEN
        RAISE EXCEPTION 'Invalid source_item_id % for table eq_batteries', NEW.source_item_id;
      END IF;
    WHEN 'eq_mounting_structures' THEN
      IF NOT EXISTS (SELECT 1 FROM public.eq_mounting_structures WHERE id = NEW.source_item_id) THEN
        RAISE EXCEPTION 'Invalid source_item_id % for table eq_mounting_structures', NEW.source_item_id;
      END IF;
    WHEN 'eq_meters' THEN
      IF NOT EXISTS (SELECT 1 FROM public.eq_meters WHERE id = NEW.source_item_id) THEN
        RAISE EXCEPTION 'Invalid source_item_id % for table eq_meters', NEW.source_item_id;
      END IF;
    WHEN 'eq_lightning_arresters' THEN
      IF NOT EXISTS (SELECT 1 FROM public.eq_lightning_arresters WHERE id = NEW.source_item_id) THEN
        RAISE EXCEPTION 'Invalid source_item_id % for table eq_lightning_arresters', NEW.source_item_id;
      END IF;
    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_quote_item_source ON public.quote_items;
CREATE TRIGGER trg_validate_quote_item_source
  BEFORE INSERT OR UPDATE OF source_item_id, source_table ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_quote_item_source();

-- ─── 8. Recreate rate_master foreign key ON DELETE CASCADE ───
ALTER TABLE public.rate_master DROP CONSTRAINT IF EXISTS rate_master_org_id_fkey;
ALTER TABLE public.rate_master ADD CONSTRAINT rate_master_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

-- ─── 9. Create Phase 3 subcontractor tables if they do not exist ───
CREATE TABLE IF NOT EXISTS public.subcontractors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organisations(id),
  name                TEXT NOT NULL,
  phone               TEXT,
  email               TEXT,
  gstin               TEXT,
  address             TEXT,
  specialization      TEXT,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.work_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organisations(id),
  project_id          UUID NOT NULL REFERENCES public.quotes(id),
  subcontractor_id    UUID NOT NULL REFERENCES public.subcontractors(id),
  wo_number           TEXT UNIQUE NOT NULL,
  description         TEXT,
  total_amount        NUMERIC(14,4) NOT NULL,
  status              TEXT DEFAULT 'draft',
  start_date          DATE,
  end_date            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subcontractor_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organisations(id),
  work_order_id       UUID NOT NULL REFERENCES public.work_orders(id),
  amount              NUMERIC(14,4) NOT NULL,
  payment_date        DATE NOT NULL,
  reference_number    TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure RLS is enabled on these new tables
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subcontractors_org ON public.subcontractors;
CREATE POLICY subcontractors_org ON public.subcontractors FOR ALL USING (org_id = public.auth_org_id());

DROP POLICY IF EXISTS work_orders_org ON public.work_orders;
CREATE POLICY work_orders_org ON public.work_orders FOR ALL USING (org_id = public.auth_org_id());

DROP POLICY IF EXISTS subcontractor_payments_org ON public.subcontractor_payments;
CREATE POLICY subcontractor_payments_org ON public.subcontractor_payments FOR ALL USING (org_id = public.auth_org_id());

-- Add aging_days column to subcontractor_payments if it is missing
ALTER TABLE public.subcontractor_payments ADD COLUMN IF NOT EXISTS aging_days INTEGER DEFAULT 0;

-- ─── 10. Trigger for subcontractor payments aging_days ───
CREATE OR REPLACE FUNCTION public.fn_subcontractor_payments_aging()
RETURNS TRIGGER AS $$
DECLARE
  v_wo_date DATE;
  v_created DATE;
BEGIN
  SELECT end_date INTO v_wo_date FROM public.work_orders WHERE id = NEW.work_order_id;
  v_created := COALESCE(NEW.created_at::date, CURRENT_DATE);
  IF v_wo_date IS NOT NULL THEN
    NEW.aging_days := COALESCE(NEW.payment_date - v_wo_date, 0);
  ELSE
    NEW.aging_days := COALESCE(NEW.payment_date - v_created, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_subcontractor_payments_aging ON public.subcontractor_payments;
CREATE TRIGGER trg_subcontractor_payments_aging
  BEFORE INSERT OR UPDATE OF payment_date, work_order_id ON public.subcontractor_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_subcontractor_payments_aging();

-- ─── 11. Check constraint for work order amount ───
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS ck_work_orders_total_amount;
ALTER TABLE public.work_orders ADD CONSTRAINT ck_work_orders_total_amount CHECK (total_amount >= 0);

-- ─── 12. Performance Indexes ───
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_included ON public.quote_items(quote_id, is_included);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_status_end ON public.org_subscriptions(org_id, status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_org_members_org_status ON public.org_members(org_id, status);
CREATE INDEX IF NOT EXISTS idx_user_devices_org_user_status ON public.user_devices(org_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_sub_status_paid ON public.subscription_payments(subscription_id, payment_status, paid_at);

-- ─── 13. Automated subscription expiry cron function ───
CREATE OR REPLACE FUNCTION public.automate_subscription_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub RECORD;
  grace_days INTEGER;
  period_end TIMESTAMPTZ;
  grace_end TIMESTAMPTZ;
  new_status TEXT;
BEGIN
  FOR sub IN
    SELECT s.id, s.org_id, s.status, s.current_period_end
    FROM public.org_subscriptions s
    WHERE s.status IN ('active', 'trialing')
      AND s.current_period_end < NOW()
  LOOP
    SELECT COALESCE((custom_settings ->> 'subscription_grace_days')::integer, 0)
    INTO grace_days
    FROM public.app_settings
    WHERE org_id = sub.org_id;

    grace_days := COALESCE(grace_days, 3); -- default to 3 days if not configured

    period_end := sub.current_period_end;
    grace_end := period_end + (grace_days * INTERVAL '1 day');

    IF NOW() > grace_end THEN
      new_status := 'expired';
    ELSE
      new_status := 'past_due';
    END IF;

    UPDATE public.org_subscriptions
    SET status = new_status, updated_at = NOW()
    WHERE id = sub.id;

    INSERT INTO public.license_events (org_id, entity_type, entity_id, event_type, event_data)
    VALUES (
      sub.org_id,
      'org_subscription',
      sub.id,
      CASE WHEN new_status = 'expired' THEN 'subscription_expired'::public.license_event_type ELSE 'subscription_updated'::public.license_event_type END,
      jsonb_build_object(
        'action', 'automated_expiry',
        'previousStatus', sub.status,
        'newStatus', new_status,
        'graceDays', grace_days
      )
    );
  END LOOP;
END;
$$;

-- ─── 14. Update saas_enforce_org_subscription_seat_limit() to only count active seats ───
CREATE OR REPLACE FUNCTION public.saas_enforce_org_subscription_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_limit INTEGER;
  billable_count INTEGER;
BEGIN
  SELECT s.seat_limit INTO active_limit
  FROM public.org_subscriptions s
  WHERE s.org_id = NEW.org_id
    AND s.status IN ('trialing', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF active_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO billable_count
  FROM public.org_members m
  WHERE m.org_id = NEW.org_id
    AND m.status = 'active'
    AND (TG_OP = 'INSERT' OR m.id <> NEW.id);

  IF billable_count >= active_limit THEN
    RAISE EXCEPTION 'Org member seat limit exceeded for org %', NEW.org_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
