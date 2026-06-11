const XLSX = require('xlsx');
const path = require('path');

const file = path.resolve(process.cwd(), 'PRICING_8.9%GST.xlsx');

function parseSheet(sheetName, workbook) {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Find header row containing 'DESCRIPTION'
  let headerRowIdx = -1;
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (row && row.some(cell => String(cell || '').trim().toUpperCase() === 'DESCRIPTION')) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return { error: 'No header row found' };
  }

  const headerRow = data[headerRowIdx];
  const colMap = {
    desc: 0,
    qty: -1,
    rate: -1,
    total: -1,
    gst: -1
  };

  headerRow.forEach((cell, idx) => {
    const text = String(cell || '').trim().toUpperCase();
    if (text === 'DESCRIPTION') colMap.desc = idx;
    else if (text.includes('QTY')) colMap.qty = idx;
    else if (text.includes('RATE') || text.includes('PRICE PER') || text.includes('RATE PER')) colMap.rate = idx;
    else if (text.includes('TOTAL')) colMap.total = idx;
    else if (text === 'GST') colMap.gst = idx;
  });

  // If some are not found, fallback to defaults
  if (colMap.qty === -1) colMap.qty = headerRow.length > 5 ? 2 : 1;
  if (colMap.rate === -1) colMap.rate = colMap.qty + 1;
  if (colMap.total === -1) colMap.total = colMap.rate + 1;
  if (colMap.gst === -1) colMap.gst = colMap.total + 1;

  console.log(`\n--- Sheet: ${sheetName} ---`);
  console.log('Detected Columns:', colMap);

  const items = [];
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;
    
    const desc = String(row[colMap.desc] || '').trim();
    if (!desc || desc.toUpperCase().includes('TOTAL') || desc.toUpperCase().includes('COST UPTO')) {
      continue;
    }
    
    const qtyCell = row[colMap.qty];
    let qty = 0;
    if (typeof qtyCell === 'number') {
      qty = qtyCell;
    } else if (qtyCell && !isNaN(parseFloat(qtyCell))) {
      qty = parseFloat(qtyCell);
    }
    
    const rateCell = row[colMap.rate];
    let rate = 0;
    if (typeof rateCell === 'number') {
      rate = rateCell;
    } else if (rateCell && !isNaN(parseFloat(rateCell))) {
      rate = parseFloat(rateCell);
    }

    const gstCell = row[colMap.gst];
    let gst = 0;
    if (typeof gstCell === 'number') {
      gst = gstCell;
    } else if (gstCell && !isNaN(parseFloat(gstCell))) {
      gst = parseFloat(gstCell);
    }

    items.push({
      desc,
      qty,
      rate,
      gst
    });
  }

  return { colMap, items };
}

try {
  const workbook = XLSX.readFile(file);
  const testSheets = ['3Kwp', '1.5kw', '2kw', 'mat 3 kw', '25kw'];
  for (const s of testSheets) {
    const result = parseSheet(s, workbook);
    if (result.error) {
      console.log(`Error parsing ${s}:`, result.error);
    } else {
      console.log(`Parsed ${result.items.length} items. First 5:`);
      console.log(result.items.slice(0, 5));
    }
  }
} catch (err) {
  console.error(err);
}
