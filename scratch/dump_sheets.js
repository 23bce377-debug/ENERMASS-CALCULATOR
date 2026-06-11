const XLSX = require('xlsx');
const path = require('path');

const file = path.resolve(process.cwd(), 'PRICING_8.9%GST.xlsx');
try {
  const workbook = XLSX.readFile(file);
  console.log('--- ALL SHEETS ---');
  console.log(workbook.SheetNames.join(', '));
  console.log(`Total sheets: ${workbook.SheetNames.length}`);
} catch (err) {
  console.error(err);
}
