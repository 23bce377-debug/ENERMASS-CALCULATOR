-- Phase 3 Hardening: Super Duper RLS
-- Replaces JWT-based org extraction with a direct un-forgeable lookup from the profiles table.

CREATE OR REPLACE FUNCTION auth_org_id() RETURNS uuid AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
