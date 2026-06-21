import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xjdqpwmizmfkcdcgcxqv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
