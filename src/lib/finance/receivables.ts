import { createClient } from '@/lib/supabase/server';
import { postJournalEntry, getChartOfAccounts } from './ledger';

/**
 * Posts a Customer Invoice to the General Ledger.
 * DR: Accounts Receivable (1200)
 * CR: Revenue (4000)
 * CR: GST Output Liability (2100)
 */
export async function postCustomerInvoiceJournal(
  orgId: string, 
  invoiceId: string, 
  taxableAmount: number, 
  taxAmount: number,
  projectId: string | null = null
) {
  const coa = await getChartOfAccounts(orgId);
  const arAcc = coa.find(a => a.code === '1200');
  const revenueAcc = coa.find(a => a.code === '4000');
  const gstOutputAcc = coa.find(a => a.code === '2100');

  if (!arAcc || !revenueAcc || !gstOutputAcc) {
    throw new Error('Chart of Accounts not properly initialized for Customer Invoice (missing 1200, 4000, or 2100)');
  }

  const totalAmount = taxableAmount + taxAmount;

  const entryId = await postJournalEntry(orgId, {
    entry_date: new Date().toISOString().split('T')[0],
    reference_no: `C-INV-${invoiceId.slice(0, 8)}`,
    description: `Customer Invoice Posting`,
    lines: [
      { account_id: arAcc.id, debit: totalAmount, credit: 0, project_id: projectId },
      { account_id: revenueAcc.id, debit: 0, credit: taxableAmount, project_id: projectId },
      { account_id: gstOutputAcc.id, debit: 0, credit: taxAmount, project_id: projectId }
    ]
  });

  return entryId;
}

/**
 * Posts a Customer Payment Receipt to the General Ledger.
 * DR: Bank / Cash (1100)
 * CR: Accounts Receivable (1200)
 */
export async function postCustomerPaymentJournal(
  orgId: string,
  paymentId: string,
  amount: number,
  projectId: string | null = null
) {
  const coa = await getChartOfAccounts(orgId);
  const bankAcc = coa.find(a => a.code === '1100');
  const arAcc = coa.find(a => a.code === '1200');

  if (!bankAcc || !arAcc) {
    throw new Error('Chart of Accounts not properly initialized for Customer Payment (missing 1100 or 1200)');
  }

  const entryId = await postJournalEntry(orgId, {
    entry_date: new Date().toISOString().split('T')[0],
    reference_no: `RCPT-${paymentId.slice(0, 8)}`,
    description: `Customer Payment Receipt`,
    lines: [
      { account_id: bankAcc.id, debit: amount, credit: 0, project_id: projectId },
      { account_id: arAcc.id, debit: 0, credit: amount, project_id: projectId }
    ]
  });

  return entryId;
}
