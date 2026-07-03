-- Fix MATH-02: DB gst_pct stored as absolute amounts, used as fractions
UPDATE eq_panels SET gst_pct = 0.12 WHERE gst_pct > 1;
UPDATE eq_inverters SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_batteries
SET gst_pct = CASE
  WHEN lower(concat_ws(' ', chemistry, brand, model, description, specification_details)) ~
       '(li[[:space:]-]?ion|lithium|lfp|life[[:space:]]?po4|lifepo4|nmc)'
    THEN 0.18
  ELSE 0.28
END
WHERE gst_pct > 1;
UPDATE eq_mounting_structures SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_meters SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_lightning_arresters SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_bom_items SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE structure_component_master SET gst_pct = 0.18 WHERE gst_pct > 1;
UPDATE eq_communication_devices SET gst_pct = 0.18 WHERE gst_pct > 1;
