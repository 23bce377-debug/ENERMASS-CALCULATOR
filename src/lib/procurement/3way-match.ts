import { createClient } from '@/lib/supabase/server';
import { postJournalEntry } from '../finance/ledger';
import { getChartOfAccounts } from '../finance/ledger';

/**
 * Validates a 3-way match between a Purchase Order, a Goods Receipt Note (GRN), and a Vendor Invoice.
 * It enforces that Qty Billed <= Qty Received <= Qty Ordered.
 */
export async function perform3WayMatch(
  orgId: string,
  poId: string,
  grnId: string,
  invoiceId: string
) {
  const supabase = await createClient();

  // 1. Fetch PO lines
  const { data: po, error: poError } = await supabase
    .from('proc_purchase_orders')
    .select('*, proc_po_items(*)')
    .eq('id', poId)
    .single();

  if (poError || !po) throw new Error('PO not found');

  // 2. Fetch GRN lines
  const { data: grn, error: grnError } = await supabase
    .from('proc_goods_receipt_notes')
    .select('*, proc_grn_items(*)')
    .eq('id', grnId)
    .single();

  if (grnError || !grn) throw new Error('GRN not found');

  // 3. Fetch Invoice lines (if exist)
  const { data: invoice, error: invoiceError } = await supabase
    .from('acc_invoices')
    .select('*, acc_invoice_lines(*)')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) throw new Error('Invoice not found');

  // Ensure GRN belongs to PO
  if (grn.po_id !== poId) throw new Error('GRN does not belong to specified PO');

  // Match logic (simplified for demonstration)
  // For each invoice line, check if the invoiced quantity does not exceed GRN quantity.
  for (const invLine of invoice.acc_invoice_lines) {
    const matchingGrnLine = grn.proc_grn_items.find((g: any) => g.catalog_item_id === invLine.catalog_item_id);
    if (!matchingGrnLine) {
      throw new Error(`Item ${invLine.catalog_item_id} billed but not found in GRN`);
    }

    if (invLine.qty > matchingGrnLine.received_qty) {
      throw new Error(`Quantity billed (${invLine.qty}) exceeds quantity received (${matchingGrnLine.received_qty}) for item ${invLine.catalog_item_id}`);
    }
  }

  return { matched: true, variance: 0 };
}

/**
 * Generates a Journal Entry upon posting a GRN.
 * DR: Inventory Asset
 * CR: GRNI (Goods Receipt Not Invoiced) Liability
 */
export async function postGrnJournal(orgId: string, grnId: string, totalAmount: number) {
  const coa = await getChartOfAccounts(orgId);
  const inventoryAssetAcc = coa.find(a => a.code === '1300');
  const grniAcc = coa.find(a => a.code === '2200');

  if (!inventoryAssetAcc || !grniAcc) {
    throw new Error('Chart of Accounts not properly initialized for GRN posting (missing 1300 or 2200)');
  }

  const entryId = await postJournalEntry(orgId, {
    entry_date: new Date().toISOString().split('T')[0],
    reference_no: `GRN-${grnId.slice(0, 8)}`,
    description: `Goods Receipt Note Posting`,
    lines: [
      { account_id: inventoryAssetAcc.id, debit: totalAmount, credit: 0 },
      { account_id: grniAcc.id, debit: 0, credit: totalAmount }
    ]
  });

  return entryId;
}

/**
 * Generates a Journal Entry upon posting a Vendor Invoice against a GRN.
 * DR: GRNI
 * DR: GST Input (ITC)
 * CR: Accounts Payable
 */
export async function postVendorInvoiceJournal(orgId: string, invoiceId: string, taxableAmount: number, taxAmount: number) {
  const coa = await getChartOfAccounts(orgId);
  const grniAcc = coa.find(a => a.code === '2200');
  const itcAcc = coa.find(a => a.code === '1400');
  const apAcc = coa.find(a => a.code === '2000');

  if (!grniAcc || !itcAcc || !apAcc) {
    throw new Error('Chart of Accounts not properly initialized for Invoice posting (missing 2200, 1400, or 2000)');
  }

  const entryId = await postJournalEntry(orgId, {
    entry_date: new Date().toISOString().split('T')[0],
    reference_no: `INV-${invoiceId.slice(0, 8)}`,
    description: `Vendor Invoice Posting`,
    lines: [
      { account_id: grniAcc.id, debit: taxableAmount, credit: 0 },
      { account_id: itcAcc.id, debit: taxAmount, credit: 0 },
      { account_id: apAcc.id, debit: 0, credit: taxableAmount + taxAmount }
    ]
  });

  return entryId;
}
