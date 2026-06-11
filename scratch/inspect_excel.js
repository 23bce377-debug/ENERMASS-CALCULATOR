const XLSX = require('xlsx');
const path = require('path');

const file = path.resolve(process.cwd(), 'PRICING_8.9%GST.xlsx');
console.log('Reading Excel file:', file);

try {
  const workbook = XLSX.readFile(file);
  console.log('Sheet Names:', workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- Sheet: ${sheetName} ---`);
    console.log(`Total Rows: ${data.length}`);
    
    // Print the first 5 rows to see structure
    for (let i = 0; i < Math.min(5, data.length); i++) {
      console.log(`Row ${i + 1}:`, data[i]);
    }
  }
} catch (err) {
  console.error('Error reading Excel file:', err);
}
