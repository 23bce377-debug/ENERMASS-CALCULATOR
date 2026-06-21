import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars so this can run standalone
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- Starting Subscription Expiry Job ---');
  const now = new Date();

  // 1. Fetch active and trialing subscriptions with a period_end in the past
  const { data: expiredSubs, error: subsError } = await supabase
    .from('org_subscriptions')
    .select('id, org_id, status, current_period_end, trial_ends_at')
    .in('status', ['active', 'trialing'])
    .lt('current_period_end', now.toISOString());

  if (subsError) {
    console.error('Failed to fetch subscriptions:', subsError.message);
    process.exit(1);
  }

  if (!expiredSubs || expiredSubs.length === 0) {
    console.log('No expired subscriptions found.');
    process.exit(0);
  }

  console.log(`Found ${expiredSubs.length} subscriptions past their period end. Processing...`);

  // Fetch app settings for all affected orgs to read grace days
  const orgIds = [...new Set(expiredSubs.map((s) => s.org_id))];
  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('org_id, custom_settings')
    .in('org_id', orgIds);

  if (settingsError) {
    console.error('Failed to fetch org settings:', settingsError.message);
    process.exit(1);
  }

  const graceDaysByOrg = new Map<string, number>();
  for (const row of settings || []) {
    const custom = row.custom_settings as Record<string, unknown> | null;
    const grace = custom?.subscription_grace_days;
    if (typeof grace === 'number') {
      graceDaysByOrg.set(row.org_id, grace);
    }
  }

  let pastDueCount = 0;
  let expiredCount = 0;

  for (const sub of expiredSubs) {
    // Note: the subscriptionService has a default grace period of 0 days. We use the same here.
    const graceDays = graceDaysByOrg.get(sub.org_id) ?? 0;
    
    const periodEnd = new Date(sub.current_period_end).getTime();
    const graceEnd = periodEnd + graceDays * 24 * 60 * 60 * 1000;
    
    // If the grace period has also expired, the status is expired.
    // If we are currently within the grace period, the status is past_due.
    const newStatus = now.getTime() > graceEnd ? 'expired' : 'past_due';

    console.log(`[Org: ${sub.org_id}] Sub: ${sub.id} -> ${sub.status} to ${newStatus} (grace: ${graceDays} days)`);

    const { error: updateError } = await supabase
      .from('org_subscriptions')
      .update({ status: newStatus })
      .eq('id', sub.id);

    if (updateError) {
      console.error(`  -> Failed to update subscription: ${updateError.message}`);
      continue;
    }

    const { error: auditError } = await supabase
      .from('license_events')
      .insert({
        org_id: sub.org_id,
        entity_type: 'org_subscription',
        entity_id: sub.id,
        event_type: newStatus === 'expired' ? 'subscription_expired' : 'subscription_updated',
        event_data: { 
          action: 'automated_expiry', 
          previousStatus: sub.status,
          newStatus,
          graceDays,
        },
      });

    if (auditError) {
      console.error(`  -> Failed to log audit event: ${auditError.message}`);
    }

    if (newStatus === 'past_due') pastDueCount++;
    else expiredCount++;
  }

  console.log(`\n--- Job Complete ---`);
  console.log(`Marked Past Due: ${pastDueCount}`);
  console.log(`Marked Expired:  ${expiredCount}`);
  process.exit(0);
}

run().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
