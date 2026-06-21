import { createClient } from '@/lib/supabase/server';

/**
 * Service to generate GSTR1/3B data based on Ledger transactions instead of flat invoice tables.
 * This provides absolute auditability: if it's not in the ledger, it's not in the tax return.
 */

export async function getGSTR1DataFromLedger(orgId: string, startDate: string, endDate: string) {
  const supabase = await createClient();

  // In a real ERP, we query the journal lines hitting the "2100" (GST Output) account
  // joined with the corresponding "4000" (Revenue) lines in the same entry to get Taxable Value.
  // We also join with the customer data to determine B2B vs B2C.
  
  // Note: Requires a database view `v_gstr1_export` to join journals properly for performance.
  const { data, error } = await supabase
    .from('v_gstr1_export')
    .select('*')
    .eq('org_id', orgId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate);

  if (error) {
    throw new Error(`Failed to fetch GSTR1 data: ${error.message}`);
  }

  return data;
}

export async function getGSTR3BDataFromLedger(orgId: string, startDate: string, endDate: string) {
  const supabase = await createClient();

  // Fetches ITC from '1400' (GST Input) and Output Liability from '2100' (GST Output)
  // Grouped by IGST, CGST, SGST.
  const { data, error } = await (supabase as any).rpc('get_gstr3b_summary', {
    p_org_id: orgId,
    p_period_start: startDate,
    p_period_end: endDate
  });

  if (error) {
    throw new Error(`Failed to fetch GSTR3B data: ${error.message}`);
  }

  return data;
}
