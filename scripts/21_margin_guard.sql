-- ============================================================
-- MIGRATION 21: Margin Guard on Quotes
-- Warns when discount pushes project below 0% net margin (P0-7)
-- ============================================================

BEGIN;

-- Add margin_alert flag to quotes for UI display
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS margin_alert BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS margin_alert_threshold NUMERIC(6,5) NOT NULL DEFAULT 0.05000; -- 5% default warning

-- Trigger function: warns on negative / below-threshold margin
CREATE OR REPLACE FUNCTION fn_validate_quote_margin()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Set margin_alert flag for UI indicator
  IF NEW.effective_margin_pct < NEW.margin_alert_threshold THEN
    NEW.margin_alert := TRUE;
  ELSE
    NEW.margin_alert := FALSE;
  END IF;

  -- Hard block for truly negative margin (< -5%)
  IF NEW.effective_margin_pct < -0.05 THEN
    RAISE EXCEPTION 'Quote margin is critically negative (%.2f%%). Discount exceeds maximum allowed. Please adjust.', 
      (NEW.effective_margin_pct * 100);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quote_margin ON quotes;
CREATE TRIGGER trg_validate_quote_margin
  BEFORE INSERT OR UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION fn_validate_quote_margin();

COMMIT;
