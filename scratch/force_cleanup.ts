import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const KEEP_EMAIL = 'hrushibhanvadiya@gmail.com';
const KEEP_ORG_NAME = 'Pitbull Corporations';

async function forceCleanup() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await pgClient.connect();
    console.log('Connected to PostgreSQL.');

    // 1. Get the target user ID and org ID to keep
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    const keepUser = users.find(u => u.email?.toLowerCase() === KEEP_EMAIL.toLowerCase());
    if (!keepUser) {
      console.error(`User ${KEEP_EMAIL} not found!`);
      return;
    }
    const keepUserId = keepUser.id;

    const orgsRes = await pgClient.query('SELECT id, name FROM public.organisations');
    const keepOrg = orgsRes.rows.find(o => o.name === KEEP_ORG_NAME);
    if (!keepOrg) {
      console.error(`Organization ${KEEP_ORG_NAME} not found!`);
      return;
    }
    const keepOrgId = keepOrg.id;

    console.log(`Keeping User: ${KEEP_EMAIL} (${keepUserId})`);
    console.log(`Keeping Org: ${KEEP_ORG_NAME} (${keepOrgId})`);

    // Disable USER triggers temporarily
    console.log('Disabling user triggers...');
    await pgClient.query('ALTER TABLE public.sys_audit_logs DISABLE TRIGGER USER');
    await pgClient.query('ALTER TABLE public.license_events DISABLE TRIGGER USER');
    await pgClient.query('ALTER TABLE public.profiles DISABLE TRIGGER USER');
    await pgClient.query('ALTER TABLE public.organisations DISABLE TRIGGER USER');

    try {
      console.log('Cleaning log and audit tables...');
      await pgClient.query('DELETE FROM public.sys_audit_logs WHERE actor_id != $1 OR actor_id IS NULL', [keepUserId]);
      await pgClient.query('DELETE FROM public.license_events WHERE user_id != $1 OR user_id IS NULL', [keepUserId]);
      await pgClient.query('DELETE FROM public.subscription_payments WHERE org_id != $1', [keepOrgId]);
      await pgClient.query('DELETE FROM public.device_reset_requests WHERE user_id != $1', [keepUserId]);

      try {
        await pgClient.query('DELETE FROM public.activation_keys WHERE redeemed_by_org_id != $1 AND redeemed_by_org_id IS NOT NULL', [keepOrgId]);
      } catch (e) {
        console.log('Skipping activation keys cleanup:', e instanceof Error ? e.message : e);
      }

      // Now delete org_members and profiles of other users
      console.log('Cleaning memberships and profiles...');
      await pgClient.query('DELETE FROM public.org_members WHERE user_id != $1', [keepUserId]);
      await pgClient.query('DELETE FROM public.profiles WHERE id != $1', [keepUserId]);

      // Delete other organizations
      console.log('Cleaning other organizations...');
      await pgClient.query('DELETE FROM public.organisations WHERE id != $1', [keepOrgId]);

      // Clear all user devices
      await pgClient.query('DELETE FROM public.user_devices');
      console.log('Cleared all user devices.');
    } finally {
      // Re-enable USER triggers in all cases
      console.log('Re-enabling user triggers...');
      await pgClient.query('ALTER TABLE public.sys_audit_logs ENABLE TRIGGER USER');
      await pgClient.query('ALTER TABLE public.license_events ENABLE TRIGGER USER');
      await pgClient.query('ALTER TABLE public.profiles ENABLE TRIGGER USER');
      await pgClient.query('ALTER TABLE public.organisations ENABLE TRIGGER USER');
    }

    // 2. Now delete users from auth.users (triggers won't fail because foreign keys are cleared)
    console.log('Deleting other users from Supabase Auth...');
    for (const user of users) {
      if (user.id === keepUserId) continue;

      console.log(`Deleting user: ${user.email} (${user.id})`);
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`Failed to delete user ${user.email}:`, deleteError);
      } else {
        console.log(`Deleted user ${user.email} successfully.`);
      }
    }

    console.log('Force cleanup completed successfully!');
  } catch (err) {
    console.error('Error during force cleanup:', err);
  } finally {
    await pgClient.end();
    console.log('Disconnected from database.');
  }
}

forceCleanup();
