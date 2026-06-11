const fs = require('fs');

try {
  const catalog = JSON.parse(fs.readFileSync('scratch/catalog.json', 'utf8'));
  console.log('--- AVAILABLE BOM ITEMS ---');
  catalog.bom_items.forEach(item => {
    console.log(`Sub-type: ${item.sub_type.padEnd(20)} | Desc: ${item.description.padEnd(30)} | Section: ${item.section}`);
  });
} catch (err) {
  console.error(err);
}
