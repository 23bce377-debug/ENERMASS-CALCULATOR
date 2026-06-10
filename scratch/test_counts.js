const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://xjdqpwmizmfkcdcgcxqv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHFwd21pem1ma2NkY2djeHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTUzNTQsImV4cCI6MjA5NTUzMTM1NH0.HtvjO-Ry3m3Rd1gTYhZ8KIisGouRU47-iwGzOW_pGtk"
);

const orgId = "00000000-0000-0000-0000-000000000001";

async function fetchCount(table, orgIsolation = false) {
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  if (orgIsolation) {
    if (orgId) {
      q = q.eq('org_id', orgId);
    } else {
      q = q.is('org_id', null);
    }
  } else {
    if (orgId) {
      q = q.or(`org_id.eq.${orgId},org_id.is.null`);
    } else {
      q = q.is('org_id', null);
    }
  }
  // Check if table has is_active or status
  if (table !== 'vendors') {
    q = q.eq('is_active', true);
  } else {
    // vendors status check? Or status='active'?
    // Let's check without is_active for vendors
  }
  const { count, error } = await q;
  if (error) {
    console.error(`Error for ${table}:`, error.message);
    return 0;
  }
  return count || 0;
}

async function run() {
  const tables = [
    { entity: 'panels', table: 'eq_panels' },
    { entity: 'inverters', table: 'eq_inverters' },
    { entity: 'batteries', table: 'eq_batteries' },
    { entity: 'structures', table: 'eq_mounting_structures' },
    { entity: 'accessories', table: 'eq_bom_items' },
    { entity: 'vendors', table: 'vendors', isolation: true },
    { entity: 'pricing', table: 'eq_bom_items', isolation: true },
    { entity: 'subsidy', table: 'calculation_schemes' }
  ];

  for (const t of tables) {
    const c = await fetchCount(t.table, t.isolation);
    console.log(`${t.entity} (${t.table}): ${c}`);
  }
}

run().catch(console.error);
