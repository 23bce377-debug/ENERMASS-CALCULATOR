const fs = require('fs');
const d = fs.readFileSync('src/lib/types/schema.types.ts', 'utf8');
const tablesMatch = d.match(/Tables:\s*\{([\s\S]*?)\}\n\s*Views:/);
if (tablesMatch) {
  const t = tablesMatch[1].match(/^\s{6}([a-z0-9_]+):\s*\{/gm);
  console.log(t ? t.map(x => x.trim().replace(/:.*/,'')).join('\n') : 'No tables found');
} else {
  console.log('Tables section not found');
}
