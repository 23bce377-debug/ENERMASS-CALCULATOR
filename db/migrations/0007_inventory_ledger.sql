-- Migration: 0007_inventory_ledger.sql

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id uuid NOT NULL REFERENCES public.catalog_items(id),
    project_id uuid REFERENCES public.epc_projects(id),
    from_state text,
    to_state text NOT NULL,
    quantity numeric NOT NULL,
    moved_by uuid REFERENCES public.profiles(id),
    moved_at timestamp with time zone DEFAULT now(),
    vehicle_number text,
    driver_contact text,
    site_received_by text,
    site_received_at timestamp with time zone,
    notes text
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Allow select for all authenticated users" 
ON public.inventory_movements FOR SELECT TO authenticated USING (true);

-- Allow insert access 
CREATE POLICY "Allow insert for warehouse and site supervisors" 
ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);

-- Explicitly deny update and delete (immutable ledger)
-- Postgres defaults to deny if no policy exists, but we'll be explicit for security
CREATE POLICY "Deny update on inventory_movements" 
ON public.inventory_movements FOR UPDATE TO authenticated USING (false);

CREATE POLICY "Deny delete on inventory_movements" 
ON public.inventory_movements FOR DELETE TO authenticated USING (false);

-- Create the view
CREATE OR REPLACE VIEW public.inventory_positions AS
SELECT
    item_id,
    project_id,
    SUM(CASE WHEN to_state = 'in_warehouse' THEN quantity ELSE 0 END)
    - SUM(CASE WHEN from_state = 'in_warehouse' THEN quantity ELSE 0 END)
    AS qty_in_warehouse,
    SUM(CASE WHEN to_state = 'in_transit' THEN quantity ELSE 0 END)
    - SUM(CASE WHEN from_state = 'in_transit' THEN quantity ELSE 0 END)
    AS qty_in_transit,
    SUM(CASE WHEN to_state = 'at_site' THEN quantity ELSE 0 END)
    - SUM(CASE WHEN from_state = 'at_site' THEN quantity ELSE 0 END)
    AS qty_at_site,
    SUM(CASE WHEN to_state = 'installed' THEN quantity ELSE 0 END)
    AS qty_installed
FROM public.inventory_movements
GROUP BY item_id, project_id;
