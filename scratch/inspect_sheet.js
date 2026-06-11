const XLSX = require('xlsx');
const path = require('path');

const file = path.resolve(process.cwd(), 'PRICING_8.9%GST.xlsx');
const targetSheet = process.argv[2] || '3Kwp';

try {
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[targetSheet];
  if (!sheet) {
    console.error(`Sheet not found: ${targetSheet}`);
    process.exit(1);
  }
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`=== SHEET: ${targetSheet} (Rows: ${data.length}) ===`);
  data.forEach((row, i) => {
    console.log(`[${i + 1}]`, JSON.stringify(row));
  });
} catch (err) {
  console.error(err);
}
