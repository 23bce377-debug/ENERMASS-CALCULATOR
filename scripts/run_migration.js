/**
 * ENERMASS ERP — Robust Migration Runner
 * Splits SQL into individual statements and runs each one,
 * capturing notices and errors per statement.
 * 
 * Usage: node scripts/run_migration.js <script.sql> [--dry-run]
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

/**
 * Split SQL into individual statements, respecting:
 * - Dollar-quoted strings ($$...$$)
 * - Single-quoted strings ('...')
 * - Comments (-- and block)
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';

  while (i < sql.length) {
    // Dollar-quote start/end
    if (!inSingleQuote && sql[i] === '$') {
      // Find the closing $
      let j = i + 1;
      while (j < sql.length && sql[j] !== '$') j++;
      if (j < sql.length) {
        const tag = sql.slice(i, j + 1);
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
          current += tag;
          i = j + 1;
          continue;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
          current += tag;
          i = j + 1;
          continue;
        }
      }
    }

    // Single quote
    if (!inDollarQuote && !inSingleQuote && sql[i] === "'") {
      inSingleQuote = true;
      current += sql[i++];
      continue;
    }
    if (inSingleQuote && sql[i] === "'") {
      if (sql[i + 1] === "'") { // escaped quote
        current += "''";
        i += 2;
        continue;
      }
      inSingleQuote = false;
      current += sql[i++];
      continue;
    }

    // Line comment — skip to end of line (outside quotes)
    if (!inSingleQuote && !inDollarQuote && sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        current += sql[i++];
      }
      continue;
    }

    // Block comment — skip (outside quotes)
    if (!inSingleQuote && !inDollarQuote && sql[i] === '/' && sql[i + 1] === '*') {
      current += sql[i++]; current += sql[i++];
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) {
        current += sql[i++];
      }
      if (i < sql.length) { current += sql[i++]; current += sql[i++]; }
      continue;
    }

    // Statement separator
    if (!inSingleQuote && !inDollarQuote && sql[i] === ';') {
      current += ';';
      const trimmed = current.trim();
      if (trimmed.length > 1) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += sql[i++];
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) statements.push(trimmed);

  return statements;
}

function printTable(rows) {
  if (!rows || rows.length === 0) { console.log('(0 rows)'); return; }
  const cols = Object.keys(rows[0]);
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length)));
  console.log(cols.map((c, i) => c.padEnd(widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w)).join('-+-'));
  for (const row of rows) {
    console.log(cols.map((c, i) => String(row[c] ?? '').padEnd(widths[i])).join(' | '));
  }
  console.log(`(${rows.length} rows)`);
}

async function runScript(scriptPath, dryRun = false) {
  const absPath = path.resolve(scriptPath);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ Script not found: ${absPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(absPath, 'utf8');
  const scriptName = path.basename(absPath);
  const statements = splitStatements(sql).filter(s => {
    const upper = s.replace(/--[^\n]*/g, '').trim().toUpperCase();
    return upper.length > 0 && upper !== ';';
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log(`▶  ${dryRun ? '[DRY RUN] ' : ''}Running: ${scriptName}`);
  console.log(`   Found ${statements.length} statements`);
  console.log(`${'='.repeat(70)}\n`);

  if (dryRun) {
    statements.forEach((s, i) => {
      console.log(`[${i + 1}] ${s.slice(0, 80).replace(/\n/g, ' ')}...`);
    });
    console.log('\n✅ Dry run complete. No changes made.');
    return;
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  client.on('notice', (msg) => {
    console.log(`  📢 NOTICE: ${msg.message}`);
  });

  await client.connect();
  let errorCount = 0;

  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.slice(0, 60).replace(/\n/g, ' ').trim();
      process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);

      try {
        const result = await client.query(stmt);
        if (result.command === 'SELECT' && result.rows?.length > 0) {
          console.log(`\n`);
          printTable(result.rows);
          console.log('');
        } else {
          console.log(`✓ (${result.command}, ${result.rowCount ?? 0} rows)`);
        }
      } catch (err) {
        console.log(`\n  ❌ ERROR: ${err.message}`);
        if (err.detail) console.log(`     Detail: ${err.detail}`);
        if (err.hint)   console.log(`     Hint:   ${err.hint}`);
        errorCount++;
        // For non-transactional errors, continue; for ROLLBACK situations, abort
        if (err.message.includes('current transaction is aborted')) {
          console.log(`  ⛔ Transaction aborted. Stopping script.`);
          break;
        }
      }
    }
  } finally {
    await client.end();
  }

  if (errorCount === 0) {
    console.log(`\n✅ ${scriptName} completed successfully (${statements.length} statements).`);
  } else {
    console.log(`\n⚠️  ${scriptName} completed with ${errorCount} error(s). Review output above.`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const scriptArg = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

if (!scriptArg) {
  console.error('Usage: node scripts/run_migration.js <path/to/script.sql> [--dry-run]');
  process.exit(1);
}

runScript(scriptArg, dryRun).catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
