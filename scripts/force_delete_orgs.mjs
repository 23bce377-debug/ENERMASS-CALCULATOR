import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  console.log('Fetching orgs...');
  const res = await client.query('SELECT id, name FROM organisations');
  
  const toDelete = res.rows.filter(r => r.name !== 'Pitbull Corporations' && r.name !== 'Demo');
  console.log(`Found ${toDelete.length} orgs to delete:`, toDelete.map(r => r.name).join(', '));

  if (toDelete.length > 0) {
    try {
      // Disable triggers temporarily
      await client.query("SET session_replication_role = 'replica';");
      console.log("Disabled triggers.");
      
      for (const org of toDelete) {
        console.log(`Attempting to delete ${org.name} (${org.id})...`);
        
        // We delete from child tables just to be clean
        const tablesWithOrgId = [
          'org_members', 'user_devices', 'device_reset_requests', 
          'subscription_payments', 'org_subscriptions', 'activation_keys', 'license_events',
          'bom_presets', 'bom_templates', 'crm_clients', 'inventory_items', 
          'projects', 'quotes', 'structure_accessory_rates', 'amc_visits', 'amc_contracts', 'amc_contracts_old', 'assets', 'bom_materials', 'bom_systems',
          'eq_panels', 'eq_inverters', 'eq_batteries', 'eq_components', 'eq_structures', 'eq_bos', 'eq_accessories', 'eq_bom_items_deprecated',
          'calendar_events', 'campaigns', 'categories', 'communications', 'contracts', 'documents', 'expense_categories',
          'systems', 'system_presets',
          'expenses', 'interactions', 'inventory_audits', 'inventory_movements', 'inventory_receipts', 'invoices',
          'maintenance_schedules', 'notes', 'order_items', 'orders', 'payments', 'performance_logs', 'presets',
          'purchase_order_items', 'purchase_orders', 'quote_items', 'rate_master', 'stock_alerts', 'suppliers',
          'system_components', 'system_performance', 'tasks', 'template_items', 'tickets', 'time_entries', 'vendor_rates', 'vendors', 'warranty_claims',
          'audit_logs' // added audit_logs
        ];
        
        for (const table of tablesWithOrgId) {
          try {
            await client.query(`DELETE FROM ${table} WHERE org_id = $1`, [org.id]);
          } catch (e) {
            // ignore if table doesn't have org_id or doesn't exist
          }
        }

        await client.query('DELETE FROM organisations WHERE id = $1', [org.id]);
        console.log(`Successfully deleted ${org.name}`);
      }
    } catch (err) {
      console.error(`Error during force deletion:`, err.message);
    } finally {
      // Re-enable triggers
      await client.query("SET session_replication_role = 'origin';");
      console.log("Re-enabled triggers.");
    }
  }

  await client.end();
}

main().catch(console.error);
