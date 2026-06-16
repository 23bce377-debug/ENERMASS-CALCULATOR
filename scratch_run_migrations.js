const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    console.log('Running 11_production_readiness_phase1_security.sql...');
    const sql11 = fs.readFileSync('scripts/11_production_readiness_phase1_security.sql', 'utf8');
    await client.query(sql11);
    console.log('Successfully ran 11_production_readiness_phase1_security.sql');

    console.log('Running 13_p0_security_reliability_remediation.sql...');
    const sql13 = fs.readFileSync('scripts/13_p0_security_reliability_remediation.sql', 'utf8');
    await client.query(sql13);
    console.log('Successfully ran 13_p0_security_reliability_remediation.sql');
  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    await client.end();
  }
}

run();
