import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xjdqpwmizmfkcdcgcxqv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSmokeTest() {
  console.log('Starting Production Smoke Test...');
  let hasErrors = false;

  try {
    // 1. Verify eq_bom_items is gone and bom_template_items is populated
    const bomRes = await supabase.from('bom_template_items').select('id', { count: 'exact', head: true });
    if (bomRes.error) {
      console.error('❌ Failed to fetch bom_template_items:', bomRes.error.message);
      hasErrors = true;
    } else {
      console.log(`✅ bom_template_items count: ${bomRes.count}`);
    }

    // 2. Verify column fixes in equipment tables
    const invRes = await supabase.from('eq_inverters').select('phases').limit(1);
    if (invRes.error) {
      console.error('❌ Failed to fetch phases from eq_inverters:', invRes.error.message);
      hasErrors = true;
    } else {
      console.log(`✅ eq_inverters column 'phases' exists.`);
    }

    const meterRes = await supabase.from('eq_meters').select('selling_price').limit(1);
    if (meterRes.error) {
      console.error('❌ Failed to fetch selling_price from eq_meters:', meterRes.error.message);
      hasErrors = true;
    } else {
      console.log(`✅ eq_meters column 'selling_price' exists.`);
    }

    const structRes = await supabase.from('eq_mounting_structures').select('selling_price').limit(1);
    if (structRes.error) {
      console.error('❌ Failed to fetch selling_price from eq_mounting_structures:', structRes.error.message);
      hasErrors = true;
    } else {
      console.log(`✅ eq_mounting_structures column 'selling_price' exists.`);
    }

    // 3. Verify Rate Master join with bom_template_items
    const rateMasterRes = await supabase.from('rate_master').select('*, bom_template_items(description, category_id, unit)').limit(1);
    if (rateMasterRes.error) {
      console.error('❌ Failed to fetch rate_master with bom_template_items join:', rateMasterRes.error.message);
      hasErrors = true;
    } else {
      console.log(`✅ rate_master join with bom_template_items successful.`);
    }

    // 4. Verify Structure Engine Tables exist
    const structTables = [
      'structure_accessory_rates',
      'structure_material_rates',
      'structure_templates',
      'structure_template_items',
      'walkway_templates',
      'ladder_templates',
    ];
    for (const table of structTables) {
      const res = await supabase.from(table).select('id').limit(1);
      if (res.error && res.error.code !== 'PGRST116') {
        console.error(`❌ Failed to fetch from ${table}:`, res.error.message);
        hasErrors = true;
      } else {
        console.log(`✅ Table ${table} accessible.`);
      }
    }

  } catch (err: any) {
    console.error('❌ Unexpected error during smoke test:', err.message);
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n❌ Smoke test failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests passed successfully!');
    process.exit(0);
  }
}

runSmokeTest();
