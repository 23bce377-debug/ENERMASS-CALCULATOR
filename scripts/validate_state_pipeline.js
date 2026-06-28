/**
 * Validation harness for the state-driven quotation pipeline migration
 * (202607040000_state_driven_pipeline.sql).
 *
 * Run this against a SUPABASE BRANCH or a local shadow DB — NOT production.
 * Point DATABASE_URL at the branch before running:
 *
 *   DATABASE_URL="postgresql://...branch..." node scripts/validate_state_pipeline.js
 *
 * It verifies the schema objects exist and that calculate_state_subsidy:
 *   - matches the legacy calculate_subsidy for a state without an override,
 *   - returns 0 for commercial,
 *   - adds additional_state_subsidy when an override is present
 *     (exercised inside a transaction that is ROLLED BACK, so no data persists).
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

let failures = 0;
function check(name, cond, detail) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // 1. Schema objects present.
  const tbls = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('system_state_availability','state_terms_templates')`
  );
  const names = tbls.rows.map((r) => r.table_name);
  check('system_state_availability exists', names.includes('system_state_availability'));
  check('state_terms_templates exists', names.includes('state_terms_templates'));

  const col = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='state_rules' AND column_name='discom_name'`
  );
  check('state_rules.discom_name exists', col.rowCount === 1);

  const fn = await client.query(`SELECT 1 FROM pg_proc WHERE proname='calculate_state_subsidy'`);
  check('calculate_state_subsidy() exists', fn.rowCount === 1);

  const globalTerms = await client.query(
    `SELECT jsonb_array_length(clauses) AS n FROM state_terms_templates WHERE state_id IS NULL AND is_active`
  );
  check('global default T&C seeded', globalTerms.rowCount === 1 && globalTerms.rows[0].n > 0,
    globalTerms.rowCount ? `${globalTerms.rows[0].n} clauses` : 'missing');

  // 2. Parity with legacy RPC for a residential state without override.
  const states = await client.query(
    `SELECT sr.state_code FROM state_rules sr
     WHERE sr.is_active AND NOT EXISTS (
       SELECT 1 FROM state_scheme_overrides o WHERE o.state_id = sr.id AND o.is_active
     ) LIMIT 1`
  );
  if (states.rowCount) {
    const code = states.rows[0].state_code;
    for (const kw of [1, 2.5, 3, 5, 12]) {
      const r = await client.query(
        `SELECT calculate_subsidy('PM_SURYA_GHAR_2024',$1,$2) AS legacy,
                calculate_state_subsidy($2,$1,'residential') AS state`,
        [kw, code]
      );
      const { legacy, state } = r.rows[0];
      check(`parity @ ${kw}kW (${code})`, Number(legacy) === Number(state), `legacy=${legacy} state=${state}`);
    }
  } else {
    console.log('• no override-free state found; skipping parity check');
  }

  // 3. Commercial → 0.
  const comm = await client.query(`SELECT calculate_state_subsidy('GJ',5,'commercial') AS v`);
  check('commercial subsidy is 0', Number(comm.rows[0].v) === 0, `got ${comm.rows[0].v}`);

  // 4. additional_state_subsidy path (transactional, rolled back).
  await client.query('BEGIN');
  try {
    const gj = await client.query(`SELECT id FROM state_rules WHERE state_code='GJ' LIMIT 1`);
    const scheme = await client.query(
      `SELECT id FROM calculation_schemes WHERE code='PM_SURYA_GHAR_2024' LIMIT 1`
    );
    if (gj.rowCount && scheme.rowCount) {
      const base = await client.query(`SELECT calculate_state_subsidy('GJ',3,'residential') AS v`);
      await client.query(
        `INSERT INTO state_scheme_overrides (state_id, scheme_id, additional_state_subsidy, is_active)
         VALUES ($1,$2,10000,TRUE)
         ON CONFLICT (state_id, scheme_id)
         DO UPDATE SET additional_state_subsidy=10000, is_active=TRUE`,
        [gj.rows[0].id, scheme.rows[0].id]
      );
      const withTopup = await client.query(`SELECT calculate_state_subsidy('GJ',3,'residential') AS v`);
      check('additional_state_subsidy adds on top',
        Number(withTopup.rows[0].v) === Number(base.rows[0].v) + 10000,
        `base=${base.rows[0].v} +10000 => ${withTopup.rows[0].v}`);
    } else {
      console.log('• GJ or PM scheme missing; skipping top-up check');
    }
  } finally {
    await client.query('ROLLBACK');
  }

  await client.end();
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
