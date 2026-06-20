import { getCachedMasterData } from './src/lib/cache/masterCache';

async function testCache() {
  try {
    const data = await getCachedMasterData();
    console.log('inverters.length:', data.inverters.length);
    console.log('meters.length:', data.meters.length);
    console.log('lightningArresters.length:', data.lightningArresters.length);
    console.log('mountingStructures.length:', data.structures.length);
  } catch (err) {
    console.error('Error loading cache:', err);
  }
}

testCache();
