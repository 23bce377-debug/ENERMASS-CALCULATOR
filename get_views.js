const fs = require('fs');
const d = fs.readFileSync('src/lib/types/schema.types.ts', 'utf8');
const viewsMatch = d.match(/Views:\s*\{([\s\S]*?)\}\n\s*Functions:/);
if (viewsMatch) {
  const v = viewsMatch[1].match(/^\s{6}([a-z0-9_]+):\s*\{/gm);
  console.log(v ? v.map(x => x.trim().replace(/:.*/,'')).join('\n') : 'No views found');
} else {
  console.log('Views section not found');
}
