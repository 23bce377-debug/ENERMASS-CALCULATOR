ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS margin_mode text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS target_margin_amount numeric(14,2);

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_margin_mode_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_margin_mode_check
  CHECK (margin_mode IN ('percent', 'flat'));

