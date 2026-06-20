const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verify() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log("=== Testing inventory_movements ledger immutability ===");

  let itemId, orgId, projectId;

  try {
    const profileRes = await client.query('SELECT org_id FROM profiles LIMIT 1');
    if (profileRes.rowCount > 0) {
      orgId = profileRes.rows[0].org_id;
    }
    const itemRes = await client.query('SELECT id FROM eq_panels LIMIT 1');
    if (itemRes.rowCount > 0) {
      itemId = itemRes.rows[0].id;
    }
    const projRes = await client.query('SELECT id FROM epc_projects LIMIT 1');
    if (projRes.rowCount > 0) {
      projectId = projRes.rows[0].id;
    }
  } catch (e) {
    console.log("Failed to query: " + e.message);
  }

  if (!itemId || !orgId || !projectId) {
    console.log(`Aborting: itemId=${itemId}, orgId=${orgId}, projectId=${projectId}`);
    await client.end();
    return;
  }

  const id = '00000000-0000-0000-0000-' + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
  console.log(`Using itemId=${itemId}, orgId=${orgId}, projectId=${projectId}, test ID=${id}`);

  // 1. Attempt INSERT
  let inserted = false;
  try {
    const insertSql = `
      INSERT INTO inventory_movements (id, org_id, item_id, project_id, to_state, quantity, moved_at, created_at)
      VALUES ($1, $2, $3, $4, 'in_warehouse', 10, NOW(), NOW())
    `;
    await client.query(insertSql, [id, orgId, itemId, projectId]);
    console.log("[SUCCESS] Inserted new inventory movement row.");
    inserted = true;
  } catch (err) {
    console.log("[FAILURE] Failed to insert new inventory movement: " + err.message);
  }

  if (!inserted) {
    await client.end();
    return;
  }

  // 2. Attempt UPDATE (quantity change)
  try {
    await client.query('UPDATE inventory_movements SET quantity = 20 WHERE id = $1', [id]);
    console.log("[CRITICAL FAILURE] Was able to update quantity!");
  } catch (err) {
    console.log("[SUCCESS] Update quantity blocked: " + err.message);
  }

  // 3. Attempt UPDATE (org_id change)
  const anotherOrgId = '11111111-1111-1111-1111-111111111111';
  try {
    await client.query('UPDATE inventory_movements SET org_id = $1 WHERE id = $2', [anotherOrgId, id]);
    console.log("[CRITICAL FAILURE] Was able to update org_id!");
  } catch (err) {
    console.log("[SUCCESS] Update org_id blocked: " + err.message);
  }

  // 4. Attempt DELETE
  try {
    await client.query('DELETE FROM inventory_movements WHERE id = $1', [id]);
    console.log("[CRITICAL FAILURE] Was able to delete row!");
  } catch (err) {
    console.log("[SUCCESS] Delete blocked: " + err.message);
  }

  // Verify the row is still there
  try {
    const checkRes = await client.query('SELECT quantity FROM inventory_movements WHERE id = $1', [id]);
    console.log(`Row still exists in DB? ${checkRes.rowCount > 0 ? "YES (Immutable)" : "NO (Deleted)"}`);
  } catch (e) {
    console.log("Check error: " + e.message);
  }

  await client.end();
}

verify();
