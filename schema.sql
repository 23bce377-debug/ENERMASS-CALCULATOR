-- ============================================================
-- ENERMASS SOLAR CALCULATOR — PRODUCTION SUPABASE SCHEMA
-- Version: 2.0.0
-- Architecture: Supabase PostgreSQL + Upstash Redis + TanStack Query
-- Concurrency: Optimistic locking via version columns
-- Caching: Redis keys and TTLs annotated per table
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search on customer names / quotes

-- ============================================================
-- SECTION 0: ENUMS & DOMAIN TYPES
-- These are immutable after deploy — add values only, never remove
-- ============================================================

CREATE TYPE system_category      AS ENUM ('on_grid', '3_phase', 'micro_inverter', 'hybrid', 'upgrade', 'commercial');
CREATE TYPE quote_status         AS ENUM ('draft', 'sent', 'won', 'lost');
CREATE TYPE project_type         AS ENUM ('residential', 'commercial');
CREATE TYPE discount_type        AS ENUM ('none', 'flat', 'percent');
CREATE TYPE sale_type            AS ENUM ('new', 'upgrade', 'referral');
CREATE TYPE inverter_type        AS ENUM ('on_grid', 'hybrid', 'micro', '3_phase');
CREATE TYPE battery_chemistry    AS ENUM ('LFP', 'Li-Ion', 'Lead-Acid', 'NMC');
CREATE TYPE la_type              AS ENUM ('single', 'multi');
CREATE TYPE meter_type           AS ENUM ('solar_meter', 'net_meter');
CREATE TYPE structure_material   AS ENUM ('gi_galvanized', 'hot_dip_galvanized', 'aluminum', 'stainless_steel', 'custom');
CREATE TYPE roof_mount_type      AS ENUM ('rcc_flat', 'rcc_sloped', 'tin_shed', 'metal_sheet', 'ground_mount', 'elevated', 'custom');
CREATE TYPE bom_section          AS ENUM (
  'solar_panels', 'power_electronics', 'metering',
  'mounting_structure', 'electrical_protection',
  'earthing', 'cabling', 'wiring', 'services'
);
-- GST slabs applicable to India
CREATE TYPE gst_slab             AS ENUM ('0', '5', '12', '18', '28');

-- ============================================================
-- SECTION 1: ORGANISATION  (Single-tenant now, multi-tenant ready)
-- Redis: "org:{org_id}" → TTL 1h
-- ============================================================

CREATE TABLE organisations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  address        TEXT,
  city           TEXT,
  state          TEXT,
  pincode        TEXT,
  phone          TEXT,
  email          TEXT,
  gstin          TEXT,
  logo_url       TEXT,
  website        TEXT,
  -- Quote numbering sequence (atomic counter — never use sequence gaps)
  quote_counter  INTEGER NOT NULL DEFAULT 1000,
  quote_prefix   TEXT NOT NULL DEFAULT 'QM',
  -- Concurrency
  version        INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 2: USER PROFILES
-- Redis: "profile:{user_id}" → TTL 30min
-- ============================================================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'sales_exec',  -- 'owner', 'admin', 'sales_exec', 'viewer'
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_org ON profiles(org_id, role);

-- ============================================================
-- SECTION 3: STATE RULES & IRRADIANCE DATA
-- Redis: "state_rules:all" → TTL 24h
-- Redis: "state_rules:{state_code}" → TTL 24h
-- Invalidate on: UPDATE state_rules
-- ============================================================

CREATE TABLE state_rules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code         TEXT UNIQUE NOT NULL,     -- 'GJ', 'RJ', 'KL', 'TN', 'MH' …
  state_name         TEXT UNIQUE NOT NULL,
  sun_hours_per_day  NUMERIC(4,2) NOT NULL,
  performance_ratio  NUMERIC(4,3) NOT NULL DEFAULT 0.780,
  labour_multiplier  NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  -- Output GST: 8.9% for most states, 13.8% for Kerala/TN/MH
  gst_on_output      NUMERIC(6,5) NOT NULL DEFAULT 0.08900,
  grid_tariff_inr    NUMERIC(6,4) NOT NULL DEFAULT 8.0000, -- ₹/kWh, state-specific default
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  version            INTEGER NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 4: PM SURYA GHAR SUBSIDY — DYNAMIC SLAB CONFIG
-- Official formula: S(P) = 30000P | P≤2
--                         60000 + 18000(P-2) | 2<P≤3
--                         78000 | P>3
-- Stored as data rows so admins can update slabs via UI
-- Redis: "subsidy_schemes:active" → TTL 1h
-- Invalidate on: UPDATE calculation_schemes, UPDATE scheme_slabs
-- ============================================================

CREATE TABLE calculation_schemes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   TEXT UNIQUE NOT NULL,    -- 'PM_SURYA_GHAR_2024'
  name                   TEXT NOT NULL,
  description            TEXT,
  applies_to             project_type NOT NULL DEFAULT 'residential',
  max_capacity_kw        NUMERIC(8,3) NOT NULL DEFAULT 10.000, -- No subsidy above this
  max_absolute_subsidy   NUMERIC(12,2) NOT NULL DEFAULT 78000.00,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from         DATE,
  effective_to           DATE,
  version                INTEGER NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each row = one slab in the piecewise formula
-- Slab 1: start=0, end=2,    rate_per_kw=30000, is_fixed=false → 30000 × min(P, 2)
-- Slab 2: start=2, end=3,    rate_per_kw=18000, is_fixed=false → 18000 × max(0, min(P,3)-2)
-- Slab 3: start=3, end=NULL, rate_per_kw=0,     is_fixed=true, fixed_amount=0 → 0
CREATE TABLE scheme_slabs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id       UUID NOT NULL REFERENCES calculation_schemes(id) ON DELETE CASCADE,
  slab_index      INTEGER NOT NULL,
  start_kw        NUMERIC(10,3) NOT NULL,
  end_kw          NUMERIC(10,3),           -- NULL = infinity
  rate_per_kw     NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  -- When TRUE: adds a fixed bonus amount regardless of capacity in slab
  is_fixed_amount BOOLEAN NOT NULL DEFAULT FALSE,
  fixed_amount    NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_scheme_slab       UNIQUE (scheme_id, slab_index),
  CONSTRAINT ck_kw_range          CHECK (end_kw IS NULL OR end_kw > start_kw),
  CONSTRAINT ck_fixed_needs_value CHECK (NOT is_fixed_amount OR fixed_amount IS NOT NULL)
);

CREATE INDEX idx_scheme_slabs_scheme ON scheme_slabs(scheme_id, slab_index);

-- State-specific subsidy overrides (some states add additional state subsidy on top)
CREATE TABLE state_scheme_overrides (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id                UUID NOT NULL REFERENCES state_rules(id) ON DELETE CASCADE,
  scheme_id               UUID NOT NULL REFERENCES calculation_schemes(id) ON DELETE CASCADE,
  max_absolute_override   NUMERIC(12,2),   -- Override the scheme cap for this state
  additional_state_subsidy NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_state_scheme UNIQUE (state_id, scheme_id)
);

-- ============================================================
-- SECTION 5: EQUIPMENT CATALOG
-- All tables use separate typed tables (not a generic EAV pattern)
-- Each has version for CAS writes, is_active for soft-delete
-- Redis namespace: "eq:{type}:active" → TTL 6h
-- ============================================================

-- 5a. SOLAR PANELS
-- Redis: "eq:panels:active" → TTL 6h
CREATE TABLE eq_panels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organisations(id),  -- NULL = global default
  brand            TEXT NOT NULL,
  model            TEXT NOT NULL,
  wattage_w        INTEGER NOT NULL,             -- e.g., 545, 580, 620
  panel_type       TEXT NOT NULL DEFAULT 'Mono PERC',  -- 'Mono PERC', 'TOPCon', 'HJT'
  rate_per_watt    NUMERIC(8,4) NOT NULL,        -- INR/W
  -- Generated: rate_per_panel = wattage × rate_per_watt
  rate_per_panel   NUMERIC(12,2) GENERATED ALWAYS AS (wattage_w * rate_per_watt) STORED,
  gst_pct          NUMERIC(6,5) NOT NULL DEFAULT 0.05000,  -- Always 5% for panels
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_custom        BOOLEAN NOT NULL DEFAULT FALSE,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_panel UNIQUE (brand, model, wattage_w)
);

CREATE INDEX idx_eq_panels_active ON eq_panels(is_active, wattage_w);

-- 5b. INVERTERS
-- Redis: "eq:inverters:active" → TTL 6h
CREATE TABLE eq_inverters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organisations(id),
  brand            TEXT NOT NULL,
  model            TEXT NOT NULL,
  capacity_kw      NUMERIC(8,3) NOT NULL,
  inverter_type    inverter_type NOT NULL,
  phases           SMALLINT NOT NULL DEFAULT 1 CHECK (phases IN (1, 3)),
  rate             NUMERIC(12,2) NOT NULL,
  gst_pct          NUMERIC(6,5) NOT NULL DEFAULT 0.12000,  -- Always 12%
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_custom        BOOLEAN NOT NULL DEFAULT FALSE,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inverter UNIQUE (brand, model, capacity_kw, inverter_type)
);

CREATE INDEX idx_eq_inverters_active ON eq_inverters(is_active, inverter_type, capacity_kw);

-- 5c. BATTERIES
-- Redis: "eq:batteries:active" → TTL 6h
CREATE TABLE eq_batteries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organisations(id),
  brand            TEXT NOT NULL,
  model            TEXT NOT NULL,
  capacity_kwh     NUMERIC(8,3) NOT NULL,
  voltage_v        INTEGER,
  chemistry        battery_chemistry NOT NULL DEFAULT 'LFP',
  dod_pct          NUMERIC(5,4) NOT NULL DEFAULT 0.80,   -- Depth of discharge
  rate             NUMERIC(12,2) NOT NULL,
  gst_pct          NUMERIC(6,5) NOT NULL DEFAULT 0.12000,  -- Always 12%
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_custom        BOOLEAN NOT NULL DEFAULT FALSE,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_battery UNIQUE (brand, model, capacity_kwh)
);

-- 5d. METERS — Solar Meter & Net/Bi-directional Meter (SEPARATE SUB-TYPES)
-- Key distinction: both types appear in BOMs, different GST, different use-case
-- Solar Meter: measures generation → GST 18%
-- Net Meter (Bi-directional): measures export/import from grid → GST 18%
-- Redis: "eq:meters:active" → TTL 6h
CREATE TABLE eq_meters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organisations(id),
  meter_type       meter_type NOT NULL,           -- 'solar_meter' | 'net_meter'
  brand            TEXT,
  model            TEXT NOT NULL,
  phases           SMALLINT NOT NULL DEFAULT 1 CHECK (phases IN (1, 3)),
  is_smart         BOOLEAN NOT NULL DEFAULT FALSE, -- Smart/CT meter for commercial
  rate             NUMERIC(12,2) NOT NULL,
  -- Both meter types attract 18% GST
  gst_pct          NUMERIC(6,5) NOT NULL DEFAULT 0.18000,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eq_meters_type ON eq_meters(meter_type, is_active);

-- 5e. LIGHTNING ARRESTERS — Single & Multi types
-- Redis: "eq:lightning_arresters:active" → TTL 6h
CREATE TABLE eq_lightning_arresters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organisations(id),
  la_type          la_type NOT NULL,              -- 'single' | 'multi'
  brand            TEXT,
  model            TEXT NOT NULL,
  -- multi-type LA covers more panels / higher capacity systems
  max_capacity_kw  NUMERIC(8,3),                  -- Recommended up to this capacity
  rate             NUMERIC(12,2) NOT NULL,
  gst_pct          NUMERIC(6,5) NOT NULL DEFAULT 0.18000,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5f. MOUNTING STRUCTURES — Weight-based pricing
-- Two pricing modes:
--   Weight-based: final_rate = weight_kg × rate_per_kg  (main mode from Excel)
--   Flat rate:    final_rate = flat_rate_override  (for quote-specific overrides)
-- Redis: "eq:structures:active" → TTL 6h
CREATE TABLE eq_mounting_structures (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID REFERENCES organisations(id),
  name                TEXT NOT NULL,
  material            structure_material NOT NULL DEFAULT 'gi_galvanized',
  roof_mount_type     roof_mount_type NOT NULL DEFAULT 'rcc_flat',
  
  -- Elevation Height (0 for standard roof-mount, in mm)
  elevation_height_mm INTEGER NOT NULL DEFAULT 0,

  -- Pricing Components (INR per kg)
  raw_material_rate   NUMERIC(10,4) NOT NULL DEFAULT 0,
  fabrication_rate    NUMERIC(10,4) NOT NULL DEFAULT 0,
  galvanizing_rate    NUMERIC(10,4) NOT NULL DEFAULT 0,
  
  -- Total Rate = Sum of components (Generated)
  rate_per_kg         NUMERIC(10,4) GENERATED ALWAYS AS (raw_material_rate + fabrication_rate + galvanizing_rate) STORED,

  -- Formula Factors (Wastage & Fasteners)
  wastage_pct         NUMERIC(6,5) NOT NULL DEFAULT 0.05000,   -- Default 5% wastage
  fastener_weight_pct NUMERIC(6,5) NOT NULL DEFAULT 0.02000,   -- Default 2% fastener weight

  -- Base Weight (Fixed minimum weight for any size installation)
  base_weight_kg      NUMERIC(10,3) NOT NULL DEFAULT 0,

  -- Optional flat rate override (ignored when NULL — weight-based used instead)
  flat_rate           NUMERIC(12,2),
  
  -- Optional per-watt rate override (ignored when NULL)
  per_watt_rate       NUMERIC(12,2),
  
  gst_pct             NUMERIC(6,5) NOT NULL DEFAULT 0.18000,
  description         TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_custom           BOOLEAN NOT NULL DEFAULT FALSE,
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Structure weight lookup by system capacity range
-- Seeded from Excel pricing sheet data (formulae and rates)
-- Effective weight = ((lookup_total_weight + structure.base_weight) * (1+wastage) * (1+fasteners))
CREATE TABLE structure_weight_lookup (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id        UUID NOT NULL REFERENCES eq_mounting_structures(id) ON DELETE CASCADE,
  
  -- Capacity range this lookup applies to
  capacity_kw_min     NUMERIC(8,3) NOT NULL,
  capacity_kw_max     NUMERIC(8,3) NOT NULL,     -- Use 9999.999 for open-ended upper
  
  panel_qty           INTEGER NOT NULL,
  weight_per_panel_kg NUMERIC(8,4) NOT NULL,     -- Variable weight component
  bracket_fixed_weight NUMERIC(10,3) NOT NULL DEFAULT 0, -- Fixed weight component for this bracket
  
  -- total_weight_kg = (panel_qty * weight_per_panel) + bracket_fixed_weight
  total_weight_kg     NUMERIC(10,3) GENERATED ALWAYS AS ((panel_qty * weight_per_panel_kg) + bracket_fixed_weight) STORED,
  
  notes               TEXT,
  CONSTRAINT ck_capacity_range CHECK (capacity_kw_max > capacity_kw_min),
  CONSTRAINT uq_structure_range UNIQUE (structure_id, capacity_kw_min, capacity_kw_max)
);

CREATE INDEX idx_structure_weight ON structure_weight_lookup(structure_id, capacity_kw_min, capacity_kw_max);

-- 5g. GENERIC BOM ITEMS (Electrical, Earthing, Cabling, Wiring, Services)
-- Covers: ACDB, DCDB, MAIN ACDB, ISOLATOR, DC CABLE, AC CABLE,
--         EARTH ROD, GI STRIP, EARTH COMPOUND, CHAMBER BOX, EARTH BENCH,
--         WIRING PIPE, WIRING TRAY, MC4, CONNECTORS, ACCESSORIES,
--         TRANSPORTATION, COMMISSION, SITE VISIT, INSTALLATION
-- Redis: "eq:bom_items:active" → TTL 6h
CREATE TABLE eq_bom_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organisations(id),
  section          bom_section NOT NULL,
  sub_type         TEXT NOT NULL,           -- e.g., 'ACDB', 'DC_CABLE', 'EARTH_ROD'
  description      TEXT NOT NULL,           -- Display label: 'ACDB', 'DC CABLE'
  remarks          TEXT,                    -- Spec: '4sqmm Solar', '10swg 1kg'
  unit             TEXT NOT NULL DEFAULT 'Nos',  -- 'Nos', 'Mtr', 'kg', 'Set', 'Lump'
  rate             NUMERIC(12,4) NOT NULL,
  gst_pct          NUMERIC(6,5) NOT NULL DEFAULT 0.18000,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_bom_item ON eq_bom_items (section, sub_type, COALESCE(org_id::TEXT, 'global'));
CREATE INDEX idx_bom_items_section ON eq_bom_items(section, is_active);
CREATE INDEX idx_bom_items_subtype ON eq_bom_items(sub_type, is_active);

-- 5h. COMMUNICATION DEVICES (micro-inverter systems: Hoymiles DTU, etc.)
-- Redis: "eq:comm_devices:active" → TTL 6h
CREATE TABLE eq_communication_devices (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID REFERENCES organisations(id),
  brand                       TEXT NOT NULL,
  model                       TEXT NOT NULL,
  compatible_inverter_brand   TEXT,
  rate                        NUMERIC(12,2) NOT NULL,
  gst_pct                     NUMERIC(6,5) NOT NULL DEFAULT 0.12000,
  description                 TEXT,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  version                     INTEGER NOT NULL DEFAULT 1,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 6: RATE MASTER
-- Admin-controlled global rate overrides per org
-- Overrides the catalog rate for a specific bom_item across ALL systems
-- Redis: "rate_master:org:{org_id}" → TTL 5min (short TTL — pricing-sensitive)
-- Invalidate on: any INSERT/UPDATE/DELETE to rate_master
-- ============================================================

CREATE TABLE rate_master (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  bom_item_id     UUID NOT NULL REFERENCES eq_bom_items(id) ON DELETE CASCADE,
  override_rate   NUMERIC(12,4) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  changed_by      UUID REFERENCES profiles(id),
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_rate_master UNIQUE (org_id, bom_item_id)
);

-- ============================================================
-- SECTION 7: SYSTEM TEMPLATES (Predefined BOMs)
-- Redis: "systems:org:{org_id}:all" → TTL 12h
-- Redis: "system:{system_id}:items" → TTL 12h
-- Invalidate on: UPDATE systems, INSERT/UPDATE system_items
-- ============================================================

CREATE TABLE systems (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID REFERENCES organisations(id),   -- NULL = global defaults
  name                TEXT NOT NULL,
  category            system_category NOT NULL,
  capacity_kw         NUMERIC(10,3) NOT NULL,
  panel_wattage_w     INTEGER,
  panel_qty           INTEGER,
  target_margin_pct   NUMERIC(6,5) NOT NULL DEFAULT 0.20000,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_custom           BOOLEAN NOT NULL DEFAULT FALSE,      -- User-created preset
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_systems_org_cat ON systems(org_id, category, is_active);

-- System BOM template items
-- Each row references exactly one catalog entry (enforced by check constraint)
CREATE TABLE system_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id               UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,

  -- Exactly ONE of these foreign keys must be non-null (enforced below)
  panel_id                UUID REFERENCES eq_panels(id),
  inverter_id             UUID REFERENCES eq_inverters(id),
  battery_id              UUID REFERENCES eq_batteries(id),
  solar_meter_id          UUID REFERENCES eq_meters(id),    -- meter_type = 'solar_meter'
  net_meter_id            UUID REFERENCES eq_meters(id),    -- meter_type = 'net_meter'
  la_id                   UUID REFERENCES eq_lightning_arresters(id),
  structure_id            UUID REFERENCES eq_mounting_structures(id),
  bom_item_id             UUID REFERENCES eq_bom_items(id),
  comm_device_id          UUID REFERENCES eq_communication_devices(id),

  -- Display (denormalized for fast reads without joins)
  section                 bom_section NOT NULL,
  description             TEXT NOT NULL,
  remarks                 TEXT,
  unit                    TEXT NOT NULL DEFAULT 'Nos',
  default_qty             NUMERIC(10,4) NOT NULL DEFAULT 0,

  -- Checkbox defaults
  is_mandatory            BOOLEAN NOT NULL DEFAULT FALSE,  -- Cannot be unchecked
  is_included_by_default  BOOLEAN NOT NULL DEFAULT TRUE,   -- Default checkbox state

  sort_order              INTEGER NOT NULL DEFAULT 0,

  -- Enforce single reference
  CONSTRAINT ck_single_ref CHECK (
    (CASE WHEN panel_id        IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN inverter_id     IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN battery_id      IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN solar_meter_id  IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN net_meter_id    IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN la_id           IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN structure_id    IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN bom_item_id     IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN comm_device_id  IS NOT NULL THEN 1 ELSE 0 END
    ) = 1
  )
);

CREATE INDEX idx_system_items_system ON system_items(system_id, sort_order);
CREATE INDEX idx_system_items_section ON system_items(system_id, section);

-- ============================================================
-- SECTION 8: CATEGORY MARGIN CONFIG (per-org, per-category)
-- Redis: "category_margins:org:{org_id}" → TTL 1h
-- ============================================================

CREATE TABLE category_margins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  category            system_category NOT NULL,
  default_margin_pct  NUMERIC(6,5) NOT NULL DEFAULT 0.20000,
  updated_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_org_category_margin UNIQUE (org_id, category)
);

-- ============================================================
-- SECTION 9: QUOTES (THE PIPELINE)
-- NOT cached — always fresh. Version used for optimistic locking.
-- Concurrency pattern:
--   Client sends: UPDATE quotes SET ... WHERE id=? AND version=?
--   On mismatch (0 rows updated): refetch → show conflict to user
-- ============================================================

CREATE TABLE quotes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organisations(id),
  quote_number            TEXT UNIQUE NOT NULL,   -- QM-2024-0001 (auto-generated)
  status                  quote_status NOT NULL DEFAULT 'draft',
  project_type            project_type NOT NULL DEFAULT 'residential',

  -- Customer
  customer_name           TEXT NOT NULL,
  customer_phone          TEXT,
  customer_whatsapp       TEXT,
  customer_email          TEXT,

  -- Address
  address_line1           TEXT,
  address_line2           TEXT,
  city                    TEXT,
  state_id                UUID REFERENCES state_rules(id),
  state_name              TEXT,                   -- Denormalized snapshot
  pincode                 TEXT,

  -- Site
  meter_number            TEXT,
  sanctioned_load_kw      NUMERIC(8,3),           -- NUMERIC, not text (per requirement)
  monthly_bill_inr        NUMERIC(10,2),          -- NUMERIC, not text
  roof_type               TEXT,
  roof_area_sqft          NUMERIC(10,2),          -- NUMERIC, not text

  -- Sales
  exec_id                 UUID REFERENCES profiles(id),
  exec_name               TEXT,
  sale_type               sale_type NOT NULL DEFAULT 'new',
  project_title           TEXT,
  notes                   TEXT,

  -- System selection (snapshot)
  system_id               UUID REFERENCES systems(id),
  system_name             TEXT,
  system_category         system_category,
  system_capacity_kw      NUMERIC(10,3),

  -- Equipment snapshots (brand + model text, not FK, to survive catalog deletions)
  panel_brand_model       TEXT,                   -- e.g., 'Adani 620W Mono PERC'
  panel_qty               INTEGER,
  panel_rate_per_panel    NUMERIC(12,2),
  inverter_brand_model    TEXT,
  inverter_qty            INTEGER,
  inverter_rate           NUMERIC(12,2),
  battery_brand_model     TEXT,
  battery_qty             INTEGER,
  battery_rate            NUMERIC(12,2),
  battery_total_kwh       NUMERIC(8,3),

  -- Discount
  discount_type           discount_type NOT NULL DEFAULT 'none',
  discount_val            NUMERIC(12,4) NOT NULL DEFAULT 0,

  -- Financial snapshot (computed at quote creation, immutable thereafter)
  cost_before_gst         NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_input_gst         NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_incl_gst          NUMERIC(14,4) NOT NULL DEFAULT 0,
  effective_margin_pct    NUMERIC(6,5) NOT NULL DEFAULT 0,
  mrp_excl_gst            NUMERIC(14,4) NOT NULL DEFAULT 0,
  gst_output_rate         NUMERIC(6,5) NOT NULL DEFAULT 0.08900,
  output_gst_amount       NUMERIC(14,4) NOT NULL DEFAULT 0,
  mrp_incl_gst            NUMERIC(14,4) NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(14,4) NOT NULL DEFAULT 0,
  additional_costs_total  NUMERIC(14,4) NOT NULL DEFAULT 0,
  final_customer_price    NUMERIC(14,4) NOT NULL DEFAULT 0,
  subsidy_scheme_id       UUID REFERENCES calculation_schemes(id),
  subsidy_amount          NUMERIC(14,4) NOT NULL DEFAULT 0,
  beneficiary_contribution NUMERIC(14,4) NOT NULL DEFAULT 0,
  per_kw_excl_gst         NUMERIC(14,4),
  per_kw_incl_gst         NUMERIC(14,4),

  -- Energy estimates (snapshot)
  annual_generation_kwh   NUMERIC(12,3),
  annual_savings_inr      NUMERIC(12,2),
  payback_years           NUMERIC(6,2),
  lifetime_savings_inr    NUMERIC(14,2),
  co2_offset_kg_per_year  NUMERIC(12,2),

  -- Quote validity (30 days from creation)
  valid_until             DATE,

  -- Optimistic locking
  version                 INTEGER NOT NULL DEFAULT 1,

  -- Audit
  created_by              UUID REFERENCES profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Centralized structure, meter and LA selections
  structure_id            UUID REFERENCES eq_mounting_structures(id) ON DELETE SET NULL,
  structure_pricing_mode  TEXT DEFAULT 'weight',
  solar_meter_id          UUID REFERENCES eq_meters(id) ON DELETE SET NULL,
  solar_meter_qty         INTEGER DEFAULT 1,
  net_meter_id            UUID REFERENCES eq_meters(id) ON DELETE SET NULL,
  net_meter_qty           INTEGER DEFAULT 1,
  la_id                   UUID REFERENCES eq_lightning_arresters(id) ON DELETE SET NULL,
  la_qty                  INTEGER DEFAULT 1,

  -- Overrides for full editability
  gst_output_override     NUMERIC(5,4),
  target_mrp_incl_gst     NUMERIC(14,4),
  target_mrp_per_watt     NUMERIC(14,4)
);

CREATE INDEX idx_quotes_org_status    ON quotes(org_id, status, created_at DESC);
CREATE INDEX idx_quotes_customer      ON quotes USING GIN (customer_name gin_trgm_ops);
CREATE INDEX idx_quotes_number        ON quotes(quote_number);
CREATE INDEX idx_quotes_system        ON quotes(system_id);
CREATE INDEX idx_quotes_exec          ON quotes(exec_id, status);

-- ============================================================
-- SECTION 10: QUOTE ITEMS (IMMUTABLE BOM SNAPSHOT)
-- Rates are copied at snapshot time — immune to future catalog changes
-- Checkboxes: is_included per row, driven by frontend UI
-- ============================================================

CREATE TABLE quote_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  -- Position in BOM
  sort_order          INTEGER NOT NULL DEFAULT 0,
  section             bom_section NOT NULL,

  -- Snapshot of item identity (not FKs — historical safety)
  description         TEXT NOT NULL,
  remarks             TEXT,
  unit                TEXT NOT NULL DEFAULT 'Nos',

  -- Snapshot of rates at quote time (NEVER updated after save)
  qty                 NUMERIC(10,4) NOT NULL DEFAULT 0,
  rate_per_unit       NUMERIC(12,4) NOT NULL DEFAULT 0,
  gst_pct             NUMERIC(6,5) NOT NULL DEFAULT 0.18000,

  -- Override audit trail (was this row customized by user?)
  original_qty        NUMERIC(10,4),       -- Template default
  original_rate       NUMERIC(12,4),       -- Catalog default
  is_qty_overridden   BOOLEAN NOT NULL DEFAULT FALSE,
  is_rate_overridden  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Checkbox state (THE key new feature)
  is_included         BOOLEAN NOT NULL DEFAULT TRUE,    -- User's checkbox state
  is_mandatory        BOOLEAN NOT NULL DEFAULT FALSE,   -- Cannot be unchecked

  -- Computed columns (stored, updated on INSERT/UPDATE trigger)
  -- Cannot use GENERATED because they depend on is_included (mutable)
  line_total          NUMERIC(14,4) NOT NULL DEFAULT 0, -- qty × rate (0 when excluded)
  line_gst            NUMERIC(14,4) NOT NULL DEFAULT 0, -- line_total × gst_pct
  line_subtotal       NUMERIC(14,4) NOT NULL DEFAULT 0, -- line_total + line_gst

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_items_quote   ON quote_items(quote_id, sort_order);
CREATE INDEX idx_quote_items_section ON quote_items(quote_id, section);

-- ============================================================
-- SECTION 11: QUOTE ADDITIONAL COSTS
-- ============================================================

CREATE TABLE quote_additional_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0 AND amount <= 10000000),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_additional_costs_quote ON quote_additional_costs(quote_id);

-- ============================================================
-- SECTION 12: QUOTE STATUS HISTORY (Full Audit Trail)
-- ============================================================

CREATE TABLE quote_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  old_status  quote_status,
  new_status  quote_status NOT NULL,
  changed_by  UUID REFERENCES profiles(id),
  notes       TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_history_quote ON quote_status_history(quote_id, changed_at DESC);

-- ============================================================
-- SECTION 13: QUOTE VARIANTS
-- Snapshot of a configuration for comparison before finalizing
-- ============================================================

CREATE TABLE quote_variants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id                UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  description             TEXT,

  -- Full override map (JSON snapshot)
  overrides_json          JSONB NOT NULL DEFAULT '{}',

  -- Variant-specific pricing params
  target_margin_pct       NUMERIC(6,5),
  discount_type           discount_type NOT NULL DEFAULT 'none',
  discount_val            NUMERIC(12,4) NOT NULL DEFAULT 0,

  -- Computed result snapshot
  mrp_incl_gst            NUMERIC(14,4),
  discount_amount         NUMERIC(14,4),
  final_customer_price    NUMERIC(14,4),
  subsidy_amount          NUMERIC(14,4),
  beneficiary_contribution NUMERIC(14,4),

  is_selected             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variants_quote ON quote_variants(quote_id);

-- ============================================================
-- SECTION 14: QUOTATION FORMAT TEMPLATES
-- Stores layout/format config as JSONB — editable via admin UI
-- Supplied format will populate template_json structure
-- Redis: "quote_templates:org:{org_id}:default" → TTL 1h
-- ============================================================

CREATE TABLE quote_format_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  template_json   JSONB NOT NULL DEFAULT '{}',
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one default template per org
CREATE UNIQUE INDEX idx_quote_templates_default
  ON quote_format_templates(org_id)
  WHERE is_default = TRUE;

-- ============================================================
-- SECTION 15: APP SETTINGS
-- Redis: "app_settings:org:{org_id}" → TTL 30min
-- ============================================================

CREATE TABLE app_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID UNIQUE NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  default_state_id        UUID REFERENCES state_rules(id),
  default_grid_tariff_inr NUMERIC(8,4) NOT NULL DEFAULT 8.0000,
  default_validity_days   INTEGER NOT NULL DEFAULT 30,
  electricity_inflation_pct NUMERIC(6,5) NOT NULL DEFAULT 0.04500,  -- 4.5% annual
  orientation_factor      NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
  updated_by              UUID REFERENCES profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- SECTION 16: FUNCTIONS
-- ============================================================

-- 16a. Updated_at auto-trigger function (applies to all tables)
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 16b. Version increment trigger (optimistic locking)
-- Applied to tables that need CAS write protection
CREATE OR REPLACE FUNCTION fn_increment_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;

-- 16c. Quote item line totals recompute trigger
CREATE OR REPLACE FUNCTION fn_recompute_line_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_included THEN
    NEW.line_total    = NEW.qty * NEW.rate_per_unit;
    NEW.line_gst      = NEW.line_total * NEW.gst_pct;
    NEW.line_subtotal = NEW.line_total + NEW.line_gst;
  ELSE
    NEW.line_total    = 0;
    NEW.line_gst      = 0;
    NEW.line_subtotal = 0;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 16d. Auto-generate quote number (atomic, no gaps under concurrency)
-- Format: {prefix}-{YYYY}-{NNNN}  e.g., QM-2024-1001
CREATE OR REPLACE FUNCTION fn_generate_quote_number(p_org_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_prefix  TEXT;
  v_counter INTEGER;
  v_year    TEXT;
BEGIN
  -- Atomic increment — prevents duplicate numbers under concurrent inserts
  UPDATE organisations
  SET quote_counter = quote_counter + 1
  WHERE id = p_org_id
  RETURNING quote_prefix, quote_counter
  INTO v_prefix, v_counter;

  v_year := TO_CHAR(NOW(), 'YYYY');
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$;

-- 16e. PM Surya Ghar subsidy — DYNAMIC, reads from scheme_slabs table
-- Usage: SELECT calculate_subsidy('PM_SURYA_GHAR_2024', 3.1, 'GJ')
CREATE OR REPLACE FUNCTION calculate_subsidy(
  p_scheme_code  TEXT,
  p_capacity_kw  NUMERIC,
  p_state_code   TEXT DEFAULT NULL
)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_scheme          RECORD;
  v_state_override  RECORD;
  v_slab            RECORD;
  v_total           NUMERIC := 0;
  v_applicable_kw   NUMERIC;
  v_effective_max   NUMERIC;
BEGIN
  -- Fetch active scheme
  SELECT id, max_capacity_kw, max_absolute_subsidy
  INTO v_scheme
  FROM calculation_schemes
  WHERE code = p_scheme_code AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Systems above max_capacity_kw get no subsidy
  IF p_capacity_kw > v_scheme.max_capacity_kw THEN RETURN 0; END IF;

  -- Check for state-specific override
  v_effective_max := v_scheme.max_absolute_subsidy;
  IF p_state_code IS NOT NULL THEN
    SELECT sso.max_absolute_override
    INTO v_state_override
    FROM state_scheme_overrides sso
    JOIN state_rules sr ON sso.state_id = sr.id
    WHERE sr.state_code = p_state_code
      AND sso.scheme_id = v_scheme.id
      AND sso.is_active = TRUE
    LIMIT 1;

    IF FOUND AND v_state_override.max_absolute_override IS NOT NULL THEN
      v_effective_max := v_state_override.max_absolute_override;
    END IF;
  END IF;

  -- Iterate slabs in order, accumulate marginal subsidy
  FOR v_slab IN
    SELECT start_kw, end_kw, rate_per_kw, is_fixed_amount, fixed_amount
    FROM scheme_slabs
    WHERE scheme_id = v_scheme.id
    ORDER BY slab_index ASC
  LOOP
    IF p_capacity_kw <= v_slab.start_kw THEN
      EXIT; -- Capacity doesn't reach this slab
    END IF;

    IF v_slab.is_fixed_amount THEN
      v_total := v_total + COALESCE(v_slab.fixed_amount, 0);
    ELSE
      -- kW that fall within this slab
      v_applicable_kw := LEAST(p_capacity_kw, COALESCE(v_slab.end_kw, p_capacity_kw))
                         - v_slab.start_kw;
      v_total := v_total + (v_applicable_kw * v_slab.rate_per_kw);
    END IF;
  END LOOP;

  -- Cap at effective maximum
  RETURN LEAST(v_total, v_effective_max);
END;
$$;

-- 16f. Compute formula-based structure rate for a given system
-- Formula: Total Weight = ((LookupWeight + BaseWeight) * (1+Wastage) * (1+Fasteners))
-- Formula: Total Cost = Total Weight * (MaterialRate + FabricationRate + GalvanizingRate)
-- Usage: SELECT get_structure_rate(structure_id, capacity_kw)
CREATE OR REPLACE FUNCTION get_structure_rate(
  p_structure_id UUID,
  p_capacity_kw  NUMERIC
)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_structure    RECORD;
  v_weight_row   RECORD;
  v_final_weight NUMERIC;
BEGIN
  SELECT * INTO v_structure
  FROM eq_mounting_structures
  WHERE id = p_structure_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Use flat rate if explicitly set (overrides weight-based logic)
  IF v_structure.flat_rate IS NOT NULL THEN
    RETURN v_structure.flat_rate;
  END IF;

  -- 1. Lookup the range-specific weight components
  SELECT total_weight_kg INTO v_weight_row
  FROM structure_weight_lookup
  WHERE structure_id = p_structure_id
    AND capacity_kw_min <= p_capacity_kw
    AND capacity_kw_max >= p_capacity_kw
  ORDER BY capacity_kw_min DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- 2. Apply Engineering Formula (Adding wastage and fastener weight)
  -- Weight = (lookup_weight + structure_base_weight) * (1 + wastage) * (1 + fasteners)
  v_final_weight := (v_weight_row.total_weight_kg + v_structure.base_weight_kg) 
                    * (1 + v_structure.wastage_pct) 
                    * (1 + v_structure.fastener_weight_pct);

  -- 3. Calculate Final Rate
  RETURN v_final_weight * v_structure.rate_per_kg;
END;
$$;


-- ============================================================
-- SECTION 17: TRIGGERS
-- ============================================================

-- Helper macro: create updated_at + version triggers for a table
-- (Called manually for each table below)

-- organisations
CREATE TRIGGER trg_organisations_updated_at
  BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_organisations_version
  BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- profiles
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- state_rules
CREATE TRIGGER trg_state_rules_updated_at
  BEFORE UPDATE ON state_rules FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_state_rules_version
  BEFORE UPDATE ON state_rules FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- calculation_schemes
CREATE TRIGGER trg_calc_schemes_updated_at
  BEFORE UPDATE ON calculation_schemes FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_calc_schemes_version
  BEFORE UPDATE ON calculation_schemes FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- Equipment tables
CREATE TRIGGER trg_eq_panels_updated_at
  BEFORE UPDATE ON eq_panels FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_eq_panels_version
  BEFORE UPDATE ON eq_panels FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

CREATE TRIGGER trg_eq_inverters_updated_at
  BEFORE UPDATE ON eq_inverters FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_eq_inverters_version
  BEFORE UPDATE ON eq_inverters FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

CREATE TRIGGER trg_eq_batteries_updated_at
  BEFORE UPDATE ON eq_batteries FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_eq_batteries_version
  BEFORE UPDATE ON eq_batteries FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

CREATE TRIGGER trg_eq_meters_updated_at
  BEFORE UPDATE ON eq_meters FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_eq_la_updated_at
  BEFORE UPDATE ON eq_lightning_arresters FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_eq_structures_updated_at
  BEFORE UPDATE ON eq_mounting_structures FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_eq_structures_version
  BEFORE UPDATE ON eq_mounting_structures FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

CREATE TRIGGER trg_eq_bom_items_updated_at
  BEFORE UPDATE ON eq_bom_items FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_eq_bom_items_version
  BEFORE UPDATE ON eq_bom_items FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- rate_master
CREATE TRIGGER trg_rate_master_updated_at
  BEFORE UPDATE ON rate_master FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_rate_master_version
  BEFORE UPDATE ON rate_master FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- systems
CREATE TRIGGER trg_systems_updated_at
  BEFORE UPDATE ON systems FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_systems_version
  BEFORE UPDATE ON systems FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- quotes
CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_quotes_version
  BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- quote_items: recompute totals on INSERT and UPDATE
CREATE TRIGGER trg_quote_items_line_totals
  BEFORE INSERT OR UPDATE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION fn_recompute_line_totals();

-- quote_variants
CREATE TRIGGER trg_quote_variants_updated_at
  BEFORE UPDATE ON quote_variants FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- quote_format_templates
CREATE TRIGGER trg_quote_templates_updated_at
  BEFORE UPDATE ON quote_format_templates FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_quote_templates_version
  BEFORE UPDATE ON quote_format_templates FOR EACH ROW EXECUTE FUNCTION fn_increment_version();


-- ============================================================
-- SECTION 18: ROW LEVEL SECURITY (RLS)
-- All data is scoped to org_id — users cannot see other orgs' data
-- ============================================================

ALTER TABLE organisations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_master            ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems                ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_margins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_additional_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_status_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_variants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_format_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE eq_panels              ENABLE ROW LEVEL SECURITY;
ALTER TABLE eq_inverters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE eq_batteries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE eq_mounting_structures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE structure_weight_lookup ENABLE ROW LEVEL SECURITY;

-- Helper: get caller's org_id from JWT claim
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() ->> 'org_id')::UUID
$$;

-- Helper: get caller's role
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'role'
$$;

-- Organisations: users see only their own org
CREATE POLICY "org_isolation" ON organisations
  USING (id = auth_org_id());

-- Profiles: users see profiles in their org
CREATE POLICY "profiles_org_isolation" ON profiles
  USING (org_id = auth_org_id());

-- Quotes: users see quotes in their org; sales_exec only sees own quotes
CREATE POLICY "quotes_org_read" ON quotes
  FOR SELECT USING (
    org_id = auth_org_id() AND (
      auth_role() IN ('owner', 'admin', 'viewer') OR
      exec_id = auth.uid()
    )
  );
CREATE POLICY "quotes_org_write" ON quotes
  FOR ALL USING (org_id = auth_org_id());

-- Quote items, costs, history, variants: follow parent quote's org
CREATE POLICY "quote_items_via_quote" ON quote_items
  USING (quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id()));

CREATE POLICY "quote_costs_via_quote" ON quote_additional_costs
  USING (quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id()));

CREATE POLICY "quote_history_via_quote" ON quote_status_history
  USING (quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id()));

CREATE POLICY "quote_variants_via_quote" ON quote_variants
  USING (quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id()));

-- Equipment: global rows (org_id IS NULL) visible to all; custom rows scoped to org
CREATE POLICY "eq_panels_visibility" ON eq_panels
  USING (org_id IS NULL OR org_id = auth_org_id());

CREATE POLICY "eq_inverters_visibility" ON eq_inverters
  USING (org_id IS NULL OR org_id = auth_org_id());

CREATE POLICY "eq_batteries_visibility" ON eq_batteries
  USING (org_id IS NULL OR org_id = auth_org_id());

-- Systems: global templates + org-specific custom systems
CREATE POLICY "systems_visibility" ON systems
  USING (org_id IS NULL OR org_id = auth_org_id());

CREATE POLICY "system_items_visibility" ON system_items
  USING (system_id IN (
    SELECT id FROM systems WHERE org_id IS NULL OR org_id = auth_org_id()
  ));

-- Rate master, margins, settings: org-scoped
CREATE POLICY "rate_master_org" ON rate_master
  USING (org_id = auth_org_id());

CREATE POLICY "category_margins_org" ON category_margins
  USING (org_id = auth_org_id());

CREATE POLICY "app_settings_org" ON app_settings
  USING (org_id = auth_org_id());

CREATE POLICY "quote_templates_org" ON quote_format_templates
  USING (org_id = auth_org_id());


-- ============================================================
-- SECTION 19: SEED DATA
-- ============================================================

-- 19a. Default organisation (single-tenant bootstrap)
INSERT INTO organisations (id, name, address, quote_prefix, quote_counter)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ENERMASS Solar',
  'Ahmedabad, Gujarat',
  'QM',
  1000
);

-- 19b. State rules
INSERT INTO state_rules (state_code, state_name, sun_hours_per_day, performance_ratio, labour_multiplier, gst_on_output, grid_tariff_inr) VALUES
  ('GJ', 'Gujarat',          5.50, 0.780, 1.000, 0.08900, 7.00),
  ('RJ', 'Rajasthan',        6.00, 0.800, 0.950, 0.08900, 7.50),
  ('MP', 'Madhya Pradesh',   5.40, 0.780, 0.920, 0.08900, 7.00),
  ('UP', 'Uttar Pradesh',    5.00, 0.760, 0.900, 0.08900, 6.50),
  ('HR', 'Haryana',          5.00, 0.770, 1.030, 0.08900, 7.50),
  ('PB', 'Punjab',           4.80, 0.760, 1.050, 0.08900, 7.50),
  ('MH', 'Maharashtra',      5.00, 0.760, 1.100, 0.13800, 9.00),
  ('KA', 'Karnataka',        5.10, 0.770, 1.080, 0.08900, 8.00),
  ('AP', 'Andhra Pradesh',   5.20, 0.770, 1.000, 0.08900, 7.00),
  ('TS', 'Telangana',        5.30, 0.780, 1.020, 0.08900, 7.00),
  ('TN', 'Tamil Nadu',       5.00, 0.770, 1.050, 0.13800, 8.50),
  ('KL', 'Kerala',           4.50, 0.750, 1.150, 0.13800, 7.50);

-- 19c. PM Surya Ghar Muft Bijli Yojana — dynamic slab seed
-- S(P) = 30000P       for P ≤ 2
--        60000+18000(P-2) for 2 < P ≤ 3
--        78000           for P > 3
INSERT INTO calculation_schemes
  (id, code, name, applies_to, max_capacity_kw, max_absolute_subsidy, is_active, effective_from)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'PM_SURYA_GHAR_2024',
  'PM Surya Ghar Muft Bijli Yojana',
  'residential',
  10.000,
  78000.00,
  TRUE,
  '2024-02-13'
);

INSERT INTO scheme_slabs (scheme_id, slab_index, start_kw, end_kw, rate_per_kw, is_fixed_amount) VALUES
  ('10000000-0000-0000-0000-000000000001', 1, 0.000,  2.000, 30000.00, FALSE),
  ('10000000-0000-0000-0000-000000000001', 2, 2.000,  3.000, 18000.00, FALSE),
  ('10000000-0000-0000-0000-000000000001', 3, 3.000,  NULL,      0.00, FALSE);

-- 19d. Category default margins
INSERT INTO category_margins (org_id, category, default_margin_pct) VALUES
  ('00000000-0000-0000-0000-000000000001', 'on_grid',        0.20000),
  ('00000000-0000-0000-0000-000000000001', '3_phase',        0.20000),
  ('00000000-0000-0000-0000-000000000001', 'micro_inverter', 0.20000),
  ('00000000-0000-0000-0000-000000000001', 'hybrid',         0.20000),
  ('00000000-0000-0000-0000-000000000001', 'upgrade',        0.15000),
  ('00000000-0000-0000-0000-000000000001', 'commercial',     0.18000);

-- 19e. App settings defaults
INSERT INTO app_settings (org_id, default_grid_tariff_inr, default_validity_days)
VALUES ('00000000-0000-0000-0000-000000000001', 8.0000, 30);

-- 19f. Meter types seed
INSERT INTO eq_meters (meter_type, model, phases, rate, gst_pct, description) VALUES
  ('solar_meter',  'Standard Single-Phase Solar Meter',  1, 1250.00, 0.18000, 'Solar Generation Meter 1-Phase'),
  ('solar_meter',  'Standard Three-Phase Solar Meter',   3, 3500.00, 0.18000, 'Solar Generation Meter 3-Phase'),
  ('net_meter',    'Net Meter Single-Phase',             1, 6800.00, 0.18000, 'Bidirectional Net Meter 1-Phase'),
  ('net_meter',    'Net Meter Three-Phase',              3, 8500.00, 0.18000, 'Bidirectional Net Meter 3-Phase'),
  ('net_meter',    'Smart CT Meter (Commercial)',        3, 24000.00, 0.18000, 'CT Meter for Commercial >10kW');

-- 19g. Lightning arrester seed
INSERT INTO eq_lightning_arresters (la_type, model, max_capacity_kw, rate, gst_pct, description) VALUES
  ('single', 'Single LA — Up to 5kW',   5.000,  250.00, 0.18000, 'Single Lightning Arrester'),
  ('single', 'Single LA — Up to 10kW', 10.000,  550.00, 0.18000, 'Single Lightning Arrester (large)'),
  ('multi',  'Multi LA — 10–30kW',     30.000, 1100.00, 0.18000, 'Multi-Point Lightning Arrester');

-- 19h. Mounting structures seed
INSERT INTO eq_mounting_structures (id, name, material, roof_mount_type, raw_material_rate, fabrication_rate, galvanizing_rate, wastage_pct, fastener_weight_pct, base_weight_kg, flat_rate, per_watt_rate, gst_pct, description) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'Apollo GP Structure', 'gi_galvanized', 'rcc_flat', 100.0000, 0.0000, 0.0000, 0.05000, 0.02000, 0.000, NULL, NULL, 0.18000, 'Apollo Galvanized Pre-painted Structure'),
  ('e1000000-0000-0000-0000-000000000002', 'Deemac GP Structure', 'gi_galvanized', 'rcc_flat', 90.0000, 0.0000, 0.0000, 0.05000, 0.02000, 0.000, NULL, NULL, 0.18000, 'Deemac Galvanized Pre-painted Structure'),
  ('e1000000-0000-0000-0000-000000000003', 'Apollo GI Structure', 'hot_dip_galvanized', 'rcc_flat', 120.0000, 0.0000, 0.0000, 0.05000, 0.02000, 0.000, NULL, NULL, 0.18000, 'Apollo Hot-Dip Galvanized Iron Structure'),
  ('e1000000-0000-0000-0000-000000000004', 'Tata GI Structure', 'hot_dip_galvanized', 'rcc_flat', 110.0000, 0.0000, 0.0000, 0.05000, 0.02000, 0.000, NULL, NULL, 0.18000, 'Tata Hot-Dip Galvanized Iron Structure');

-- 19i. Mounting structure weight lookups seed
INSERT INTO structure_weight_lookup (structure_id, capacity_kw_min, capacity_kw_max, panel_qty, weight_per_panel_kg, bracket_fixed_weight, notes) VALUES
  -- 3kW (6 Panels)
  ('e1000000-0000-0000-0000-000000000001', 0.000, 3.500, 6, 0.0000, 12.000, '3kW Apollo GP'),
  ('e1000000-0000-0000-0000-000000000002', 0.000, 3.500, 6, 0.0000, 10.000, '3kW Deemac GP'),
  ('e1000000-0000-0000-0000-000000000003', 0.000, 3.500, 6, 0.0000, 18.000, '3kW Apollo GI'),
  ('e1000000-0000-0000-0000-000000000004', 0.000, 3.500, 6, 0.0000, 21.000, '3kW Tata GI'),
  -- 4kW (8 Panels)
  ('e1000000-0000-0000-0000-000000000001', 3.500, 4.500, 8, 0.0000, 143.000, '4kW Apollo GP'),
  ('e1000000-0000-0000-0000-000000000002', 3.500, 4.500, 8, 0.0000, 46.000, '4kW Deemac GP'),
  ('e1000000-0000-0000-0000-000000000003', 3.500, 4.500, 8, 0.0000, 31.000, '4kW Apollo GI'),
  ('e1000000-0000-0000-0000-000000000004', 3.500, 4.500, 8, 0.0000, 121.000, '4kW Tata GI'),
  -- 5kW (9 Panels)
  ('e1000000-0000-0000-0000-000000000001', 4.500, 999.000, 9, 0.0000, 44.000, '5kW Apollo GP'),
  ('e1000000-0000-0000-0000-000000000002', 4.500, 999.000, 9, 0.0000, 13.000, '5kW Deemac GP'),
  ('e1000000-0000-0000-0000-000000000003', 4.500, 999.000, 9, 0.0000, 121.000, '5kW Apollo GI'),
  ('e1000000-0000-0000-0000-000000000004', 4.500, 999.000, 9, 0.0000, 42.000, '5kW Tata GI');


-- ============================================================
-- SECTION 20: USEFUL VIEWS (for fast API reads / TanStack Query)
-- ============================================================

-- 20a. Active equipment catalog (all types) — useful for autocomplete / selectors
CREATE VIEW v_active_panels AS
  SELECT id, 'panel' AS eq_type, brand, model,
         wattage_w::TEXT AS capacity, rate_per_panel AS rate,
         gst_pct, is_custom
  FROM eq_panels WHERE is_active = TRUE ORDER BY brand, wattage_w;

CREATE VIEW v_active_inverters AS
  SELECT id, 'inverter' AS eq_type, brand, model,
         capacity_kw::TEXT AS capacity, rate,
         gst_pct, inverter_type::TEXT AS sub_type, is_custom
  FROM eq_inverters WHERE is_active = TRUE ORDER BY brand, capacity_kw;

CREATE VIEW v_active_batteries AS
  SELECT id, 'battery' AS eq_type, brand, model,
         capacity_kwh::TEXT AS capacity, rate,
         gst_pct, chemistry::TEXT AS sub_type, is_custom
  FROM eq_batteries WHERE is_active = TRUE ORDER BY brand, capacity_kwh;

-- 20b. Quote summary (for the pipeline list view — no heavy joins needed)
CREATE VIEW v_quote_summary AS
  SELECT
    q.id, q.quote_number, q.status, q.project_type,
    q.customer_name, q.customer_phone,
    s.state_name,
    q.system_name, q.system_capacity_kw, q.system_category,
    q.mrp_incl_gst, q.subsidy_amount, q.beneficiary_contribution,
    q.discount_type, q.discount_amount,
    q.panel_brand_model, q.panel_qty,
    q.inverter_brand_model,
    q.created_at, q.updated_at, q.valid_until,
    q.exec_name,
    q.version
  FROM quotes q
  LEFT JOIN state_rules s ON q.state_id = s.id;

-- 20c. System with computed BOM cost (for system browser comparison)
CREATE VIEW v_system_bom_totals AS
  SELECT
    s.id, s.name, s.category, s.capacity_kw,
    s.panel_wattage_w, s.panel_qty, s.target_margin_pct,
    COUNT(si.id) AS item_count
  FROM systems s
  LEFT JOIN system_items si ON si.system_id = s.id
  WHERE s.is_active = TRUE
  GROUP BY s.id, s.name, s.category, s.capacity_kw,
           s.panel_wattage_w, s.panel_qty, s.target_margin_pct;

-- 20d. Quote items with section subtotals
CREATE VIEW v_quote_section_totals AS
  SELECT
    quote_id,
    section,
    SUM(line_total) AS section_cost,
    SUM(line_gst) AS section_gst,
    SUM(line_subtotal) AS section_subtotal,
    COUNT(*) FILTER (WHERE is_included) AS included_items
  FROM quote_items
  GROUP BY quote_id, section;

-- 20e. Dynamic subsidy verification (useful for admin audit)
CREATE  VIEW v_subsidy_slabs AS
  SELECT
    cs.code, cs.name, cs.max_capacity_kw, cs.max_absolute_subsidy,
    ss.slab_index, ss.start_kw, ss.end_kw,
    ss.rate_per_kw, ss.is_fixed_amount, ss.fixed_amount
  FROM calculation_schemes cs
  JOIN scheme_slabs ss ON ss.scheme_id = cs.id
  WHERE cs.is_active = TRUE
  ORDER BY cs.code, ss.slab_index;

-- Migration/Upgrade statement for existing environments:
ALTER TABLE quotes 
  ADD COLUMN IF NOT EXISTS structure_id UUID REFERENCES eq_mounting_structures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS structure_pricing_mode TEXT DEFAULT 'weight',
  ADD COLUMN IF NOT EXISTS solar_meter_id UUID REFERENCES eq_meters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS solar_meter_qty INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS net_meter_id UUID REFERENCES eq_meters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS net_meter_qty INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS la_id UUID REFERENCES eq_lightning_arresters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS la_qty INTEGER DEFAULT 1;