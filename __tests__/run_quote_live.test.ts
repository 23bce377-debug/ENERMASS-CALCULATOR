import { describe, it, vi } from 'vitest';
import { Client } from 'pg';
import { calculateSystemFromDb } from '../src/lib/engine/dbCalculator';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: () => {},
    get: () => undefined
  })
}));

describe('Live Quote Calculations', () => {
  it('runs quotes and prints output', async () => {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    await client.connect();

    // Query a system template ID from the database
    const sysRes = await client.query("SELECT id, name FROM systems LIMIT 1");
    if (sysRes.rowCount === 0) {
      console.log("No systems found.");
      await client.end();
      return;
    }
    const systemId = sysRes.rows[0].id;
    console.log(`[TEST] Using system template: ${sysRes.rows[0].name} (${systemId})`);

    const cases = [
      {
        name: "Residential Quote (Kerala)",
        input: {
          systemId,
          state: "Kerala",
          pricingContext: { projectType: 'residential', targetMarginPct: 0.15 },
          orgId: "00000000-0000-0000-0000-000000000001"
        }
      },
      {
        name: "Commercial Quote (Kerala)",
        input: {
          systemId,
          state: "Kerala",
          pricingContext: { projectType: 'commercial', targetMarginPct: 0.20 },
          orgId: "00000000-0000-0000-0000-000000000001"
        }
      }
    ];

    for (const tc of cases) {
      console.log(`\n=== Running Live Calculation for: ${tc.name} ===`);
      try {
        const output = await calculateSystemFromDb(client, tc.input as any);
        console.log("SUCCESS");
        console.log("Line Items count:", output.lines.length);
        console.log("Lines sample:", output.lines.slice(0, 3));
        console.log("Pricing:", JSON.stringify(output.pricing, null, 2));
        console.log("Subsidy:", JSON.stringify(output.subsidy, null, 2));
        console.log("Margin:", JSON.stringify(output.margin, null, 2));
      } catch (err: any) {
        console.log("FAILED");
        console.log(err.message, err.stack);
      }
    }

    await client.end();
  });
});
