const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to DB!");

  // 1. Query vendors
  const vendorsRes = await client.query("SELECT * FROM vendors");
  console.log("\n=== VENDORS ===");
  console.log(vendorsRes.rows);

  // 2. Query eq_mounting_structures
  const structuresRes = await client.query("SELECT id, org_id, name, is_active FROM eq_mounting_structures");
  console.log("\n=== MOUNTING STRUCTURES ===");
  console.log(structuresRes.rows);

  // 3. Query eq_bom_items
  const bomRes = await client.query("SELECT id, org_id, section, sub_type, is_active FROM eq_bom_items LIMIT 5");
  console.log("\n=== BOM ITEMS (first 5) ===");
  console.log(bomRes.rows);

  // 4. Query calculation_schemes
  const schemeRes = await client.query("SELECT id, code, name, is_active FROM calculation_schemes");
  console.log("\n=== CALCULATION SCHEMES ===");
  console.log(schemeRes.rows);

  // 5. Query structure_vendors, structure_material_rates, structure_templates, walkway_templates, ladder_templates
  const structVendors = await client.query("SELECT * FROM structure_vendors");
  console.log("\n=== STRUCTURE VENDORS ===");
  console.log(structVendors.rows);

  const materialRates = await client.query("SELECT * FROM structure_material_rates");
  console.log("\n=== STRUCTURE MATERIAL RATES ===");
  console.log(materialRates.rows);

  const walkwayTemplates = await client.query("SELECT * FROM walkway_templates");
  console.log("\n=== WALKWAY TEMPLATES ===");
  console.log(walkwayTemplates.rows);

  const ladderTemplates = await client.query("SELECT * FROM ladder_templates");
  console.log("\n=== LADDER TEMPLATES ===");
  console.log(ladderTemplates.rows);

  await client.end();
}

run().catch(console.error);
