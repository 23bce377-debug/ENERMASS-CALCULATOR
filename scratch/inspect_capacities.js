const XLSX = require('xlsx');
const path = require('path');

const file = path.resolve(process.cwd(), 'PRICING_8.9%GST.xlsx');

try {
  const workbook = XLSX.readFile(file);
  console.log('--- SHEET CAPACITIES IN EXCEL ---');
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length < 2) continue;

    // Search for G1/G2 or row index 0/1 column index 6
    let declaredCap = 'N/A';
    if (data[1] && data[1][6] !== undefined) declaredCap = data[1][6];
    else if (data[0] && data[0][6] !== undefined) declaredCap = data[0][6];

    // Find panel qty and wattage to compute calculated capacity
    let panelQty = 0;
    let panelWatt = 540; // Default if not found
    for (let r = 0; r < Math.min(25, data.length); r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;
      const desc = String(row[0] || '').trim().toUpperCase();
      if (desc === 'PANEL') {
        panelQty = Number(row[2] || 0);
        const remarks = String(row[1] || '');
        const wattMatch = remarks.match(/WATT:(\d+)/i);
        if (wattMatch) panelWatt = Number(wattMatch[1]);
      }
    }
    
    const calculatedCap = panelQty > 0 ? (panelQty * panelWatt) / 1000.0 : 0;
    console.log(`Sheet: ${sheetName.padEnd(25)} | Declared: ${String(declaredCap).padEnd(10)} | Calc: ${calculatedCap.toFixed(2)} kW (Qty: ${panelQty}, Watt: ${panelWatt})`);
  }
} catch (err) {
  console.error(err);
}
