-- ============================================================
-- MIGRATION 12: Deploy Missing Atomic RPC Functions
-- ============================================================
-- These 3 functions are called by the application ORM but
-- do not exist in the live database, causing P0 feature failures:
--   - create_acquisition_atomic  → AcquisitionORM.create()
--   - create_bundle_preset_atomic → BundlePresetORM.create()
--   - update_bundle_preset_atomic → BundlePresetORM.update()
-- ============================================================

BEGIN;

-- ============================================================
-- 1. create_acquisition_atomic
-- Called by: src/backend/orm/acquisition.ts L159
-- Creates acquisition + all its line items in one transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION create_acquisition_atomic(
  p_acquisition JSONB,
  p_items       JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acq_id UUID;
  v_result JSONB;
  v_item JSONB;
BEGIN
  -- Validate positive quantities in all items (P0-5)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) AS item
  LOOP
    IF (v_item->>'qty')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Acquisition item quantity must be positive. Found: %', (v_item->>'qty')::NUMERIC;
    END IF;
    IF (v_item->>'rate_per_unit')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Acquisition item rate cannot be negative. Found: %', (v_item->>'rate_per_unit')::NUMERIC;
    END IF;
  END LOOP;

  -- Insert the acquisition header
  INSERT INTO acquisitions (
    org_id,
    vendor_id,
    invoice_number,
    invoice_date,
    total_amount,
    status,
    notes
  )
  SELECT
    (p_acquisition->>'org_id')::UUID,
    (p_acquisition->>'vendor_id')::UUID,
    p_acquisition->>'invoice_number',
    (p_acquisition->>'invoice_date')::DATE,
    (p_acquisition->>'total_amount')::NUMERIC,
    COALESCE(p_acquisition->>'status', 'pending')::acquisition_status,
    p_acquisition->>'notes'
  RETURNING id INTO v_acq_id;

  -- Insert all line items
  INSERT INTO acquisition_items (
    acquisition_id,
    catalog_item_id,
    item_description,
    category,
    qty,
    unit,
    rate_per_unit,
    gst_pct
  )
  SELECT
    v_acq_id,
    (item->>'catalog_item_id')::UUID,
    (item->>'item_description'),
    (item->>'category')::bom_section,
    (item->>'qty')::NUMERIC,
    COALESCE(item->>'unit', 'Nos'),
    (item->>'rate_per_unit')::NUMERIC,
    (item->>'gst_pct')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  -- Return the created acquisition with items
  SELECT jsonb_build_object(
    'id',             a.id,
    'org_id',         a.org_id,
    'vendor_id',      a.vendor_id,
    'invoice_number', a.invoice_number,
    'invoice_date',   a.invoice_date,
    'total_amount',   a.total_amount,
    'status',         a.status,
    'notes',          a.notes,
    'created_at',     a.created_at,
    'updated_at',     a.updated_at
  )
  INTO v_result
  FROM acquisitions a
  WHERE a.id = v_acq_id;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 2. create_bundle_preset_atomic
-- Called by: src/backend/orm/bundle.ts L26
-- Creates bundle preset + all its items in one transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION create_bundle_preset_atomic(
  p_preset JSONB,
  p_items  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preset_id UUID;
  v_result    JSONB;
  v_item JSONB;
BEGIN
  -- Validate positive quantities in all items (P0-5)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) AS item
  LOOP
    IF (v_item->>'qty')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Bundle preset item quantity must be positive. Found: %', (v_item->>'qty')::NUMERIC;
    END IF;
    IF (v_item->>'base_cost')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Bundle preset item base_cost cannot be negative. Found: %', (v_item->>'base_cost')::NUMERIC;
    END IF;
  END LOOP;

  -- Insert preset header
  INSERT INTO bundle_presets (
    org_id,
    vendor_id,
    name,
    effective_bundle_price,
    allocation_strategy,
    notes,
    is_active,
    gst_pct,
    created_by
  )
  SELECT
    (p_preset->>'org_id')::UUID,
    (p_preset->>'vendor_id')::UUID,
    p_preset->>'name',
    (p_preset->>'effective_bundle_price')::NUMERIC,
    COALESCE(p_preset->>'allocation_strategy', 'proportional_cost'),
    p_preset->>'notes',
    COALESCE((p_preset->>'is_active')::BOOLEAN, TRUE),
    (p_preset->>'gst_pct')::NUMERIC,
    (p_preset->>'created_by')::UUID
  RETURNING id INTO v_preset_id;

  -- Insert items
  INSERT INTO bundle_preset_items (
    bundle_preset_id,
    catalog_item_id,
    item_description,
    category,
    qty,
    unit,
    base_cost,
    allocated_cost_override,
    gst_pct
  )
  SELECT
    v_preset_id,
    (item->>'catalog_item_id')::UUID,
    (item->>'item_description'),
    (item->>'category')::bom_section,
    (item->>'qty')::NUMERIC,
    COALESCE(item->>'unit', 'Nos'),
    (item->>'base_cost')::NUMERIC,
    (item->>'allocated_cost_override')::NUMERIC,
    (item->>'gst_pct')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  -- Return created preset
  SELECT jsonb_build_object(
    'id',                     bp.id,
    'org_id',                 bp.org_id,
    'vendor_id',              bp.vendor_id,
    'name',                   bp.name,
    'effective_bundle_price', bp.effective_bundle_price,
    'allocation_strategy',    bp.allocation_strategy,
    'notes',                  bp.notes,
    'is_active',              bp.is_active,
    'gst_pct',                bp.gst_pct,
    'created_by',             bp.created_by,
    'created_at',             bp.created_at,
    'updated_at',             bp.updated_at,
    'version',                bp.version
  )
  INTO v_result
  FROM bundle_presets bp
  WHERE bp.id = v_preset_id;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 3. update_bundle_preset_atomic
-- Called by: src/backend/orm/bundle.ts L35
-- Updates preset header + replaces items atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION update_bundle_preset_atomic(
  p_preset_id UUID,
  p_updates   JSONB,
  p_items     JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_item JSONB;
BEGIN
  -- Validate positive quantities in items if provided (P0-5)
  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) AS item
    LOOP
      IF (v_item->>'qty')::NUMERIC <= 0 THEN
        RAISE EXCEPTION 'Bundle preset item quantity must be positive. Found: %', (v_item->>'qty')::NUMERIC;
      END IF;
      IF (v_item->>'base_cost')::NUMERIC < 0 THEN
        RAISE EXCEPTION 'Bundle preset item base_cost cannot be negative. Found: %', (v_item->>'base_cost')::NUMERIC;
      END IF;
    END LOOP;
  END IF;

  -- Update preset header fields (only fields present in JSONB)
  UPDATE bundle_presets SET
    vendor_id              = CASE WHEN p_updates ? 'vendor_id'              THEN (p_updates->>'vendor_id')::UUID              ELSE vendor_id END,
    name                   = CASE WHEN p_updates ? 'name'                   THEN p_updates->>'name'                           ELSE name END,
    effective_bundle_price = CASE WHEN p_updates ? 'effective_bundle_price' THEN (p_updates->>'effective_bundle_price')::NUMERIC ELSE effective_bundle_price END,
    allocation_strategy    = CASE WHEN p_updates ? 'allocation_strategy'    THEN p_updates->>'allocation_strategy'            ELSE allocation_strategy END,
    notes                  = CASE WHEN p_updates ? 'notes'                  THEN p_updates->>'notes'                          ELSE notes END,
    is_active              = CASE WHEN p_updates ? 'is_active'              THEN (p_updates->>'is_active')::BOOLEAN           ELSE is_active END,
    gst_pct                = CASE WHEN p_updates ? 'gst_pct'                THEN (p_updates->>'gst_pct')::NUMERIC             ELSE gst_pct END,
    updated_at             = NOW()
  WHERE id = p_preset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bundle preset not found: %', p_preset_id;
  END IF;

  -- Replace items if provided
  IF p_items IS NOT NULL THEN
    DELETE FROM bundle_preset_items WHERE bundle_preset_id = p_preset_id;

    INSERT INTO bundle_preset_items (
      bundle_preset_id,
      catalog_item_id,
      item_description,
      category,
      qty,
      unit,
      base_cost,
      allocated_cost_override,
      gst_pct
    )
    SELECT
      p_preset_id,
      (item->>'catalog_item_id')::UUID,
      (item->>'item_description'),
      (item->>'category')::bom_section,
      (item->>'qty')::NUMERIC,
      COALESCE(item->>'unit', 'Nos'),
      (item->>'base_cost')::NUMERIC,
      (item->>'allocated_cost_override')::NUMERIC,
      (item->>'gst_pct')::NUMERIC
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  -- Return updated preset
  SELECT jsonb_build_object(
    'id',                     bp.id,
    'org_id',                 bp.org_id,
    'vendor_id',              bp.vendor_id,
    'name',                   bp.name,
    'effective_bundle_price', bp.effective_bundle_price,
    'allocation_strategy',    bp.allocation_strategy,
    'notes',                  bp.notes,
    'is_active',              bp.is_active,
    'gst_pct',                bp.gst_pct,
    'created_by',             bp.created_by,
    'created_at',             bp.created_at,
    'updated_at',             bp.updated_at,
    'version',                bp.version
  )
  INTO v_result
  FROM bundle_presets bp
  WHERE bp.id = p_preset_id;

  RETURN v_result;
END;
$$;

-- ============================================================
-- Validation
-- ============================================================
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname IN (
    'create_acquisition_atomic',
    'create_bundle_preset_atomic',
    'update_bundle_preset_atomic'
  );
  RAISE NOTICE '✅ Atomic RPC functions deployed: % / 3 present', v_count;
  IF v_count < 3 THEN
    RAISE EXCEPTION 'Not all RPC functions were deployed. Expected 3, got %.', v_count;
  END IF;
END $$;

COMMIT;
