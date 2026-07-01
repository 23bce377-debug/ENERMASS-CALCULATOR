-- Keep quote status updates as status-only operations.
-- Project/procurement creation must be explicit, not triggered by setting a quote to won.

DROP TRIGGER IF EXISTS trg_generate_pr_on_quote_won ON public.quotes;
DROP FUNCTION IF EXISTS public.fn_generate_pr_on_bom_finalize();
