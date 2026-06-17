-- Drop the unused workflow tables
DROP TABLE IF EXISTS epc_project_milestones CASCADE;
DROP TABLE IF EXISTS epc_site_surveys CASCADE;

-- Relax constraints and add a simple notes field to the projects table
ALTER TABLE epc_projects ADD COLUMN IF NOT EXISTS project_notes TEXT;

-- Note: We are keeping net_metering_applications table for now as it might be used elsewhere,
-- but we are removing the auto-creation logic from the projects ORM.
