import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xjdqpwmizmfkcdcgcxqv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHFwd21pem1ma2NkY2djeHF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk1NTM1NCwiZXhwIjoyMDk1NTMxMzU0fQ.kvGHH_cGCod6e_izeQ6kIwsZtEcM4oq7_NvyQBbec5s'
);

async function verifyCacheLoad() {
  console.log('--- DB Verification ---');
  
  const inverters = await supabase.from('eq_inverters').select('id, phases, selling_price').eq('is_active', true);
  console.log('inverters.length:', inverters.data?.length);

  const meters = await supabase.from('eq_meters').select('id, selling_price').eq('is_active', true);
  console.log('meters.length:', meters.data?.length);

  const las = await supabase.from('eq_lightning_arresters').select('id, selling_price').eq('is_active', true);
  console.log('lightningArresters.length:', las.data?.length);

  const structures = await supabase.from('eq_mounting_structures').select('id, selling_price').eq('is_active', true);
  console.log('mountingStructures.length:', structures.data?.length);
  
  if (inverters.error) console.error(inverters.error);
  if (meters.error) console.error(meters.error);
  if (las.error) console.error(las.error);
  if (structures.error) console.error(structures.error);
}

verifyCacheLoad();
