const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    const res = await client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'dispatch_reserved_stock'");
    if (res.rows.length > 0) {
      console.log(res.rows[0].pg_get_functiondef);
    } else {
      console.log("Not found");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
