const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const file = path.resolve(process.cwd(), 'PRICING_8.9%GST.xlsx');

try {
  const workbook = XLSX.readFile(file);
  const mapping = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length < 2) {
      mapping.push({ sheetName, error: 'Empty sheet' });
      continue;
    }

    // Try to find capacity in row 1 or 2, column index 6 (G)
    const capacityVal = data[1] ? data[1][6] : null;
    
    // Scan rows to find PANEL and INVERTER
    let panelInfo = null;
    let inverterInfo = null;
    let panelQty = null;
    let inverterQty = null;
    let inverterRate = null;

    for (let r = 0; r < Math.min(25, data.length); r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;
      const desc = String(row[0] || '').trim().toUpperCase();
      
      if (desc === 'PANEL') {
        panelInfo = row[1] ? String(row[1]).trim() : 'Generic';
        panelQty = row[2];
      }
      if (desc === 'INVERTER') {
        inverterInfo = row[1] ? String(row[1]).trim() : 'Generic';
        inverterQty = row[2];
        inverterRate = row[3];
      }
    }

    mapping.push({
      sheetName,
      capacity: capacityVal,
      panelInfo,
      panelQty,
      inverterInfo,
      inverterQty,
      inverterRate,
      rowCount: data.length
    });
  }

  fs.writeFileSync('scratch/excel_sheets_summary.json', JSON.stringify(mapping, null, 2));
  console.log('✅ Wrote summary to scratch/excel_sheets_summary.json');
} catch (err) {
  console.error('Error:', err);
}
