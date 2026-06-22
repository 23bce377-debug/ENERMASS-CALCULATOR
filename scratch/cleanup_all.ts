import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const KEEP_EMAIL = 'hrushibhanvadiya@gmail.com';
const KEEP_ORG_NAME = 'Pitbull Corporations';

async function cleanupAll() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 1. Delete users from auth.users except hrushibhanvadiya@gmail.com
    console.log('--- CLEANING AUTH USERS ---');
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    const keepUser = users.find(u => u.email?.toLowerCase() === KEEP_EMAIL.toLowerCase());
    if (!keepUser) {
      console.error(`User ${KEEP_EMAIL} not found! Cannot proceed with deletion of all other users safely.`);
      return;
    }

    for (const user of users) {
      if (user.id === keepUser.id) {
        console.log(`Keeping user: ${user.email} (${user.id})`);
        continue;
      }
      console.log(`Deleting user: ${user.email} (${user.id})`);
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`Failed to delete user ${user.email}:`, deleteError);
      } else {
        console.log(`Deleted user ${user.email} successfully.`);
      }
    }

    // 2. Connect to PostgreSQL to clean up organizations, profiles, and devices
    console.log('--- CLEANING DATABASE ---');
    await pgClient.connect();
    console.log('Connected to PostgreSQL.');

    // Fetch orgs first
    const orgsRes = await pgClient.query('SELECT id, name FROM public.organisations');
    console.log('Orgs in DB:', orgsRes.rows);

    const keepOrg = orgsRes.rows.find(o => o.name === KEEP_ORG_NAME);
    if (!keepOrg) {
      console.error(`Organization ${KEEP_ORG_NAME} not found!`);
      return;
    }

    console.log(`Keeping organization: ${keepOrg.name} (${keepOrg.id})`);

    // Delete other organizations (this will cascade delete subscriptions, members, reset requests, etc.)
    const deleteOrgsRes = await pgClient.query(
      'DELETE FROM public.organisations WHERE id != $1',
      [keepOrg.id]
    );
    console.log(`Deleted other organizations. Rows affected: ${deleteOrgsRes.rowCount}`);

    // Clean up profiles table for deleted users (if not cascaded)
    const deleteProfilesRes = await pgClient.query(
      'DELETE FROM public.profiles WHERE id != $1',
      [keepUser.id]
    );
    console.log(`Deleted other profiles. Rows affected: ${deleteProfilesRes.rowCount}`);

    // Delete device resets not associated with the keepUser
    const deleteResetsRes = await pgClient.query(
      'DELETE FROM public.device_reset_requests WHERE user_id != $1',
      [keepUser.id]
    );
    console.log(`Deleted other reset requests. Rows affected: ${deleteResetsRes.rowCount}`);

    // Let's clear ALL devices except the current active device of keepUser (or clear them completely so they can register fresh)
    const deleteDevicesRes = await pgClient.query(
      'DELETE FROM public.user_devices'
    );
    console.log(`Cleared all user devices so they can register fresh. Rows affected: ${deleteDevicesRes.rowCount}`);

    console.log('Cleanup completed successfully!');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await pgClient.end();
    console.log('Disconnected from database.');
  }
}

cleanupAll();
