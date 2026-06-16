const fs = require('fs');
const d = fs.readFileSync('src/lib/types/schema.types.ts', 'utf8');
const tablesMatch = d.match(/Tables:\s*\{([\s\S]*?)\}\n\s*Views:/);
if (tablesMatch) {
  const t = tablesMatch[1];
  const tables = ['acc_accounts', 'acc_journal_entries', 'acc_journal_lines', 'acc_invoices'];
  tables.forEach(name => {
    const idx = t.indexOf(`        ${name}: {`);
    if (idx !== -1) {
      let nextIdx = t.indexOf('        }', idx);
      // find the proper closing bracket by looking for the next table start or end of string
      const nextTableMatch = t.substring(idx + 10).search(/\n\s{8}[a-z0-9_]+:\s*\{/);
      if (nextTableMatch !== -1) {
        console.log(t.substring(idx, idx + 10 + nextTableMatch));
      } else {
        console.log(t.substring(idx, idx + 2000)); // fallback
      }
    }
  });
}
