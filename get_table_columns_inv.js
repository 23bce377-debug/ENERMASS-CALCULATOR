const fs = require('fs');
const t = fs.readFileSync('src/lib/types/schema.types.ts', 'utf8');
const m = t.match(/inv_stock_transactions: \{[\s\S]*?inv_transfers:/);
if (m) console.log(m[0]);
const m2 = t.match(/inv_stock_balances: \{[\s\S]*?inv_stock_transactions:/);
if (m2) console.log(m2[0]);
