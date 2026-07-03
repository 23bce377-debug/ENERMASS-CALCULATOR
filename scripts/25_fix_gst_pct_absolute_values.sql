-- Fix MATH-02: DB gst_pct stored as absolute amounts, used as fractions
UPDATE eq_panels SET gst_pct = 0.05 WHERE gst_pct > 1;
UPDATE eq_inverters SET gst_pct = 0.05 WHERE gst_pct > 1;
UPDATE eq_batteries SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_mounting_structures SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_meters SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_lightning_arresters SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_bom_items SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE structure_component_master SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_communication_devices SET gst_pct = 0.18 WHERE gst_pct > 1;
