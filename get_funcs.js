const fs = require('fs');
const d = fs.readFileSync('src/lib/types/schema.types.ts', 'utf8');
const fMatch = d.match(/Functions:\s*\{([\s\S]*?)\}\n\s*Enums:/);
if (fMatch) {
  const f = fMatch[1].match(/^\s{6}([a-z0-9_]+):\s*\{/gm);
  console.log(f ? f.map(x => x.trim().replace(/:.*/,'')).join('\n') : 'No functions found');
} else {
  console.log('Functions section not found');
}
