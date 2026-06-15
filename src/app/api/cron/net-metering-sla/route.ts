import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const STAGE_SLA_DAYS: Record<string, number> = {
  feasibility:  15,
  registration: 30,
  inspection:   21,
  meter_change: 15,
};

export async function GET(req: Request) {
  try {
    // Verify auth header for Vercel Cron
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all active applications
    const { data: apps, error } = await supabaseAdmin
      .from('net_metering_applications')
      .select('id, project_id, current_stage, updated_at, epc_projects(org_id, project_number, assigned_pm_id)')
      .neq('current_stage', 'approved');

    if (error) {
      throw error;
    }

    const now = new Date();
    let breachCount = 0;

    for (const app of apps || []) {
      const stage = app.current_stage;
      const slaDays = STAGE_SLA_DAYS[stage];
      if (!slaDays) continue;

      const lastUpdate = new Date(app.updated_at || now);
      const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
      const daysInStage = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysInStage > slaDays) {
        breachCount++;
        const proj = Array.isArray(app.epc_projects) ? app.epc_projects[0] : app.epc_projects;
        if (!proj) continue;

        // Add to system notifications
        await supabaseAdmin.from('sys_notifications').insert({
          org_id: proj.org_id,
          recipient_id: proj.assigned_pm_id, // Send to PM, or NULL for org admins
          title: `⚠ Net Metering SLA Breach — ${proj.project_number}`,
          body: `Stage '${stage}' is ${daysInStage} days overdue (SLA: ${slaDays} days). Follow up immediately.`,
          is_read: false
        });

        // Also update the net metering app notes to flag it
        await supabaseAdmin
          .from('net_metering_applications')
          .update({
            notes: `[SYSTEM FLAG] SLA Breached on ${now.toISOString().split('T')[0]}: ${daysInStage} days in stage ${stage}`
          })
          .eq('id', app.id);
      }
    }

    return NextResponse.json({ success: true, breachesFound: breachCount });
  } catch (err: any) {
    console.error('Net Metering SLA Cron Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
