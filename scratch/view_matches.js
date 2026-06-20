const fs = require('fs');
const files = [
  'src/backend/orm/equipment.ts',
  'src/lib/actions/presets.ts',
  'src/lib/hooks/useMasters.ts',
  'src/lib/hooks/useSettings.ts',
  'src/app/master/page.tsx',
  'src/app/master/accessories/page.tsx',
  'src/app/master/pricing/page.tsx',
  'src/app/api/sync/route.ts',
  'src/app/api/erp/bootstrap/route.ts'
];

files.forEach(file => {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    console.log(`\n=== ${file} ===`);
    lines.forEach((line, i) => {
      if (line.includes('eq_bom_items')) {
        console.log(`Line ${i + 1}: ${line.trim()}`);
      }
    });
  } catch (e) {
    console.error(`Failed to read ${file}:`, e.message);
  }
});
