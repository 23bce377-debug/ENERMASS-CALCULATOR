import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Fetch panels
    const panelsRes = await client.query('SELECT * FROM eq_panels WHERE is_active = true');
    const panels = panelsRes.rows;

    const inventoryRes = await client.query('SELECT * FROM inventory_summary');
    const inventorySummary = inventoryRes.rows || [];

    const mappedPanels = panels.map((p: any) => {
      const description = `${p.brand} ${p.model} ${Number(p.wattage_w)}W Panel`;
      const invMatch = inventorySummary.find((item: any) => item.item_description === description);
      const wac = invMatch && Number(invMatch.weighted_avg_cost) > 0 ? Number(invMatch.weighted_avg_cost) : null;
      return {
        id: p.id,
        brand: p.brand,
        model: p.model,
        wattage: Number(p.wattage_w),
        type: p.panel_type,
        ratePerWatt: wac !== null ? wac / Number(p.wattage_w) : (Number(p.wattage_w) > 0 ? Number(p.selling_price) / Number(p.wattage_w) : 0),
        gst_pct: Number(p.gst_pct),
      };
    });

    console.log('--- mappedPanels sample ---');
    console.log(mappedPanels.slice(0, 5));

    const nullRatePanels = mappedPanels.filter((p: any) => p.ratePerWatt === null || isNaN(p.ratePerWatt));
    console.log(`--- NULL OR NaN RATE PANELS (${nullRatePanels.length}) ---`);
    console.log(nullRatePanels);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
