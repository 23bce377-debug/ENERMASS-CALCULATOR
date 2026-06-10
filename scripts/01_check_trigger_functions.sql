-- Check the actual columns on eq_panels, eq_inverters, eq_batteries in live DB
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'eq_panels'
ORDER BY ordinal_position;
