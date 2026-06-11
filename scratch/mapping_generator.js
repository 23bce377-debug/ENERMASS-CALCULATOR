const { Client } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const excelFile = path.resolve(process.cwd(), 'PRICING_8.9%GST.xlsx');
  const workbook = XLSX.readFile(excelFile);

  const dbSystems = (await client.query("SELECT id, name, category, capacity_kw FROM systems ORDER BY name")).rows;
  
  // Parse excel summary
  const sheetSummaries = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length < 2) continue;
    
    // G2 capacity cell
    const capacityVal = data[1] ? Number(data[1][6] || 0) : 0;
    
    let panelQty = 0;
    let inverterRate = 0;
    let inverterCapacity = 0;

    for (let r = 0; r < Math.min(25, data.length); r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;
      const desc = String(row[0] || '').trim().toUpperCase();
      if (desc === 'PANEL') {
        panelQty = Number(row[2] || 0);
      }
      if (desc === 'INVERTER') {
        inverterCapacity = Number(row[1] || 0);
        inverterQty = Number(row[2] || 0);
        inverterRate = Number(row[3] || 0);
      }
    }

    sheetSummaries.push({
      sheetName,
      capacity: capacityVal,
      panelQty,
      inverterCapacity,
      inverterRate,
      rowCount: data.length
    });
  }

  // Build mapping
  const mapped = [];
  const unmapped = [];

  for (const dbSys of dbSystems) {
    const cap = Number(dbSys.capacity_kw);
    
    // Exact or close match on capacity
    let matches = sheetSummaries.filter(s => Math.abs(s.capacity - cap) < 0.05);

    // If no capacity match, try matching by name/prefix
    if (matches.length === 0) {
      if (dbSys.name === '0 KWp On-Grid') {
        matches = sheetSummaries.filter(s => s.sheetName.toLowerCase().includes('inkel') && s.capacity === 0);
      } else if (dbSys.name === '1.1 KWp On-Grid') {
        matches = sheetSummaries.filter(s => s.sheetName === '1kw admn');
      } else if (dbSys.name === '3.54 KWp On-Grid') {
        matches = sheetSummaries.filter(s => s.sheetName === 'mis working');
      } else if (dbSys.name === '3.54 KWp 8kW MIS') {
        matches = sheetSummaries.filter(s => s.sheetName === 'mis working');
      }
    }

    // Try name direct mapping
    if (matches.length > 1) {
      // Find the one that matches category or name best
      const cleanName = dbSys.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const best = matches.find(m => {
        const cleanSheet = m.sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanSheet.includes(cleanName) || cleanName.includes(cleanSheet);
      });
      if (best) {
        matches = [best];
      }
    }

    if (matches.length > 0) {
      mapped.push({
        systemId: dbSys.id,
        systemName: dbSys.name,
        category: dbSys.category,
        capacity_kw: dbSys.capacity_kw,
        matchedSheet: matches[0].sheetName,
        sheetCapacity: matches[0].capacity,
        panelQty: matches[0].panelQty,
        inverterRate: matches[0].inverterRate
      });
    } else {
      unmapped.push(dbSys);
    }
  }

  console.log(`=== MAPPED SYSTEMS (${mapped.length}) ===`);
  console.log(JSON.stringify(mapped, null, 2));

  console.log(`=== UNMAPPED SYSTEMS (${unmapped.length}) ===`);
  console.log(JSON.stringify(unmapped, null, 2));

  fs.writeFileSync('scratch/system_sheet_mappings.json', JSON.stringify({ mapped, unmapped }, null, 2));
  await client.end();
}

main().catch(console.error);
