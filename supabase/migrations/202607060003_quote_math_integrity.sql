-- Enforce quote/BOM math integrity at the database boundary.
-- Quote items keep the app-calculated allocated line totals, but the DB rejects
-- rows where stored totals drift materially from qty x rate x GST.

ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS ck_quote_items_math_nonnegative;

ALTER TABLE public.quote_items
  ADD CONSTRAINT ck_quote_items_math_nonnegative
  CHECK (
    qty >= 0
    AND rate_per_unit >= 0
    AND gst_pct >= 0
    AND gst_pct <= 1
    AND line_total >= 0
    AND line_gst >= 0
    AND line_subtotal >= 0
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.validate_quote_item_math()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_expected_total numeric;
  v_expected_gst numeric;
  v_expected_subtotal numeric;
  v_tolerance numeric := 0.10;
BEGIN
  IF NEW.gst_pct > 1 THEN
    RAISE EXCEPTION 'quote_items.gst_pct must be stored as a fraction, got %', NEW.gst_pct;
  END IF;

  IF COALESCE(NEW.is_included, true) = false THEN
    v_expected_total := 0;
  ELSE
    v_expected_total := ROUND((COALESCE(NEW.qty, 0) * COALESCE(NEW.rate_per_unit, 0))::numeric, 2);
  END IF;

  v_expected_gst := ROUND((v_expected_total * COALESCE(NEW.gst_pct, 0))::numeric, 2);
  v_expected_subtotal := ROUND((v_expected_total + v_expected_gst)::numeric, 2);

  IF ABS(COALESCE(NEW.line_total, 0) - v_expected_total) > v_tolerance THEN
    RAISE EXCEPTION 'quote_items line_total mismatch for "%": got %, expected %',
      NEW.description, NEW.line_total, v_expected_total;
  END IF;

  IF ABS(COALESCE(NEW.line_gst, 0) - v_expected_gst) > v_tolerance THEN
    RAISE EXCEPTION 'quote_items line_gst mismatch for "%": got %, expected %',
      NEW.description, NEW.line_gst, v_expected_gst;
  END IF;

  IF ABS(COALESCE(NEW.line_subtotal, 0) - v_expected_subtotal) > v_tolerance THEN
    RAISE EXCEPTION 'quote_items line_subtotal mismatch for "%": got %, expected %',
      NEW.description, NEW.line_subtotal, v_expected_subtotal;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quote_item_math ON public.quote_items;
CREATE TRIGGER trg_validate_quote_item_math
  BEFORE INSERT OR UPDATE OF qty, rate_per_unit, gst_pct, is_included, line_total, line_gst, line_subtotal
  ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_quote_item_math();
