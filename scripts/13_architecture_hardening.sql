-- ============================================================
-- ENERMASS ERP — 13_architecture_hardening.sql
-- ============================================================

-- DB-03: Fix system_items ck_single_ref constraint
ALTER TABLE system_items DROP CONSTRAINT IF EXISTS ck_single_ref;
ALTER TABLE system_items ADD CONSTRAINT ck_single_ref CHECK (
  num_nonnulls(panel_id, inverter_id, battery_id, solar_meter_id, net_meter_id, la_id, structure_id, bom_item_id, comm_device_id, structure_component_id) = 1
);
