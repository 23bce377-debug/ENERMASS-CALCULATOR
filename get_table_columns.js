const fs = require('fs');
const t = fs.readFileSync('src/lib/types/schema.types.ts', 'utf8');
const m = t.match(/acc_accounts: \{[\s\S]*?acc_bank_statement_lines:/);
if (m) console.log(m[0]);
const m2 = t.match(/acc_journal_entries: \{[\s\S]*?acc_journal_lines: \{[\s\S]*?acc_payments:/);
if (m2) console.log(m2[0]);
