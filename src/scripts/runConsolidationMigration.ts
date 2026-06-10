import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  console.log('═══ ENERMASS Database Pricing Consolidation Migration Runner ═══\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected successfully. Running migration steps...');

    // 1. Drop rate master
    console.log('Step 1: Dropping rate_master overrides...');
    await client.query('DROP TABLE IF EXISTS rate_master CASCADE;');

    // 2. eq_panels
    console.log('Step 2: Altering eq_panels and migrating pricing...');
    await client.query(`
      ALTER TABLE eq_panels ADD COLUMN IF NOT EXISTS buy_price NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE eq_panels ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2) DEFAULT 0.00;
    `);
    await client.query(`
      UPDATE eq_panels SET 
        selling_price = wattage_w * rate_per_watt,
        buy_price = wattage_w * rate_per_watt
      WHERE rate_per_watt IS NOT NULL;
    `);
    await client.query('ALTER TABLE eq_panels DROP COLUMN IF EXISTS rate_per_panel CASCADE;');
    await client.query('ALTER TABLE eq_panels DROP COLUMN IF EXISTS rate_per_watt CASCADE;');
    await client.query(`
      ALTER TABLE eq_panels ALTER COLUMN buy_price SET NOT NULL;
      ALTER TABLE eq_panels ALTER COLUMN selling_price SET NOT NULL;
    `);

    // 3. Other equipment tables (PL/pgSQL block)
    console.log('Step 3: Altering other equipment and BOM tables...');
    await client.query(`
      DO $$
      BEGIN
          -- eq_inverters
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_inverters' AND column_name='rate') THEN
              ALTER TABLE eq_inverters RENAME COLUMN rate TO selling_price;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_inverters' AND column_name='buy_price') THEN
              ALTER TABLE eq_inverters ADD COLUMN buy_price NUMERIC(12,2) NOT NULL DEFAULT 0.00;
              UPDATE eq_inverters SET buy_price = selling_price;
          END IF;

          -- eq_batteries
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_batteries' AND column_name='rate') THEN
              ALTER TABLE eq_batteries RENAME COLUMN rate TO selling_price;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_batteries' AND column_name='buy_price') THEN
              ALTER TABLE eq_batteries ADD COLUMN buy_price NUMERIC(12,2) NOT NULL DEFAULT 0.00;
              UPDATE eq_batteries SET buy_price = selling_price;
          END IF;

          -- eq_meters
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_meters' AND column_name='rate') THEN
              ALTER TABLE eq_meters RENAME COLUMN rate TO selling_price;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_meters' AND column_name='buy_price') THEN
              ALTER TABLE eq_meters ADD COLUMN buy_price NUMERIC(12,2) NOT NULL DEFAULT 0.00;
              UPDATE eq_meters SET buy_price = selling_price;
          END IF;

          -- eq_lightning_arresters
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_lightning_arresters' AND column_name='rate') THEN
              ALTER TABLE eq_lightning_arresters RENAME COLUMN rate TO selling_price;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_lightning_arresters' AND column_name='buy_price') THEN
              ALTER TABLE eq_lightning_arresters ADD COLUMN buy_price NUMERIC(12,2) NOT NULL DEFAULT 0.00;
              UPDATE eq_lightning_arresters SET buy_price = selling_price;
          END IF;

          -- eq_mounting_structures
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_mounting_structures' AND column_name='flat_rate') THEN
              ALTER TABLE eq_mounting_structures RENAME COLUMN flat_rate TO selling_price;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_mounting_structures' AND column_name='buy_price') THEN
              ALTER TABLE eq_mounting_structures ADD COLUMN buy_price NUMERIC(12,2) NOT NULL DEFAULT 0.00;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_mounting_structures' AND column_name='selling_price') THEN
              ALTER TABLE eq_mounting_structures ADD COLUMN selling_price NUMERIC(12,2);
          END IF;
          UPDATE eq_mounting_structures SET buy_price = COALESCE(selling_price, 0) WHERE buy_price = 0;

          -- eq_bom_items
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_bom_items' AND column_name='rate') THEN
              ALTER TABLE eq_bom_items RENAME COLUMN rate TO selling_price;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_bom_items' AND column_name='buy_price') THEN
              ALTER TABLE eq_bom_items ADD COLUMN buy_price NUMERIC(12,4) NOT NULL DEFAULT 0.00;
              UPDATE eq_bom_items SET buy_price = selling_price;
          END IF;

          -- eq_communication_devices
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_communication_devices' AND column_name='rate') THEN
              ALTER TABLE eq_communication_devices RENAME COLUMN rate TO selling_price;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eq_communication_devices' AND column_name='buy_price') THEN
              ALTER TABLE eq_communication_devices ADD COLUMN buy_price NUMERIC(12,2) NOT NULL DEFAULT 0.00;
              UPDATE eq_communication_devices SET buy_price = selling_price;
          END IF;
      END $$;
    `);

    // 4. Recreate views
    console.log('Step 4: Recreating active catalog views...');
    await client.query('DROP VIEW IF EXISTS v_active_panels CASCADE;');
    await client.query(`
      CREATE OR REPLACE VIEW v_active_panels AS
        SELECT id, 'panel' AS eq_type, brand, model,
               wattage_w::TEXT AS capacity, selling_price AS rate,
               gst_pct, is_custom
        FROM eq_panels WHERE is_active = TRUE ORDER BY brand, wattage_w;
    `);

    await client.query('DROP VIEW IF EXISTS v_active_inverters CASCADE;');
    await client.query(`
      CREATE OR REPLACE VIEW v_active_inverters AS
        SELECT id, 'inverter' AS eq_type, brand, model,
               capacity_kw::TEXT AS capacity, selling_price AS rate,
               gst_pct, inverter_type::TEXT AS sub_type, is_custom
        FROM eq_inverters WHERE is_active = TRUE ORDER BY brand, capacity_kw;
    `);

    await client.query('DROP VIEW IF EXISTS v_active_batteries CASCADE;');
    await client.query(`
      CREATE OR REPLACE VIEW v_active_batteries AS
        SELECT id, 'battery' AS eq_type, brand, model,
               capacity_kwh::TEXT AS capacity, selling_price AS rate,
               gst_pct, chemistry::TEXT AS sub_type, is_custom
        FROM eq_batteries WHERE is_active = TRUE ORDER BY brand, capacity_kwh;
    `);

    // 5. Recreate function
    console.log('Step 5: Recreating get_structure_rate function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION get_structure_rate(
        p_structure_id UUID,
        p_capacity_kw  NUMERIC
      )
      RETURNS NUMERIC AS $$
      DECLARE
        v_structure    RECORD;
        v_weight_row   RECORD;
        v_final_weight NUMERIC;
      BEGIN
        SELECT * INTO v_structure
        FROM eq_mounting_structures
        WHERE id = p_structure_id;

        IF NOT FOUND THEN RETURN 0; END IF;

        -- Use flat rate/selling price if explicitly set (overrides weight-based logic)
        IF v_structure.selling_price IS NOT NULL THEN
          RETURN v_structure.selling_price;
        END IF;

        -- 1. Lookup the range-specific weight components
        SELECT total_weight_kg INTO v_weight_row
        FROM structure_weight_lookup
        WHERE structure_id = p_structure_id
          AND capacity_kw_min <= p_capacity_kw
          AND capacity_kw_max >= p_capacity_kw
        ORDER BY capacity_kw_min DESC
        LIMIT 1;

        IF NOT FOUND THEN RETURN 0; END IF;

        -- 2. Apply Engineering Formula (Adding wastage and fastener weight)
        -- Weight = (lookup_weight + structure_base_weight) * (1 + wastage) * (1 + fasteners)
        v_final_weight := (v_weight_row.total_weight_kg + v_structure.base_weight_kg) 
                          * (1 + v_structure.wastage_pct) 
                          * (1 + v_structure.fastener_weight_pct);

        -- 3. Calculate Final Rate
        RETURN v_final_weight * v_structure.rate_per_kg;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    console.log('✅ Migration applied successfully and database refactoring completed!');
  } catch (error) {
    console.error('❌ Migration failed!');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
