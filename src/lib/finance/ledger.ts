import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Define the schema for a journal entry line
export const journalLineSchema = z.object({
  account_id: z.string().uuid(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  project_id: z.string().uuid().optional().nullable(),
}).refine(data => {
  // Line must have either debit or credit, but not both at the same time for the exact same amount unless it's a zero entry which is invalid
  return (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0);
}, {
  message: "A single journal line must be exclusively a debit or a credit, and must be greater than zero.",
});

// Define the schema for a journal entry header
export const journalEntrySchema = z.object({
  entry_date: z.string().date(), // 'YYYY-MM-DD'
  reference_no: z.string().max(255).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  lines: z.array(journalLineSchema).min(2),
}).refine(data => {
  const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
  // Compare with a small epsilon for floating point arithmetic safety if dealing with numbers, 
  // but using integer cents is preferred. Assuming amounts are passed correctly.
  return Math.abs(totalDebit - totalCredit) < 0.001;
}, {
  message: "Journal entry must balance (total debits must equal total credits).",
});

export type JournalEntryPayload = z.infer<typeof journalEntrySchema>;

/**
 * Creates a balanced Journal Entry in the General Ledger.
 * Enforces strictly double-entry accounting.
 * 
 * @param orgId The tenant organization ID
 * @param payload The validated Journal Entry payload
 * @returns The new journal entry ID
 */
export async function postJournalEntry(orgId: string, payload: JournalEntryPayload): Promise<string> {
  const supabase = await createClient();

  // The database RPC will enforce transaction safety, balancing, and org scoping.
  const { data: entryId, error } = await supabase.rpc('create_journal_entry', {
    p_org_id: orgId,
    p_entry_date: payload.entry_date,
    p_reference_no: payload.reference_no || null,
    p_description: payload.description || null,
    p_lines: payload.lines,
  } as any);

  if (error) {
    console.error('[Ledger] Failed to post journal entry:', error);
    throw new Error(`Failed to post journal entry: ${error.message}`);
  }

  return entryId as string;
}

/**
 * Utility to fetch Chart of Accounts for an organization.
 */
export async function getChartOfAccounts(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('acc_accounts')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch COA: ${error.message}`);
  }

  return data;
}
