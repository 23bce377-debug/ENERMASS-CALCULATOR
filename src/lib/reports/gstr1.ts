import { Database } from '../types/schema.types';

type Invoice = Database['public']['Tables']['acc_invoices']['Row'];

/**
 * Generates GSTR-1 CSV format from a list of invoices
 */
export function generateGSTR1CSV(invoices: Invoice[]): string {
  // GSTR-1 standard B2B/B2C columns
  const headers = [
    'GSTIN/UIN of Recipient',
    'Invoice Number',
    'Invoice Date',
    'Invoice Value',
    'Place Of Supply',
    'Reverse Charge',
    'Invoice Type',
    'Rate',
    'Taxable Value',
    'Integrated Tax Amount',
    'Central Tax Amount',
    'State/UT Tax Amount',
    'Cess Amount'
  ];

  const rows = invoices.map(invOrig => {
    const inv: any = invOrig;
    // Determine the POS (Place of supply code)
    const pos = inv.customer_state_code ? `${inv.customer_state_code}-State` : '24-Gujarat';
    
    // Determine rate based on GST amounts and taxable value
    let rate = 0;
    if (inv.taxable_amount && inv.taxable_amount > 0) {
      if (inv.igst_amount && inv.igst_amount > 0) {
        rate = Math.round((inv.igst_amount / inv.taxable_amount) * 100);
      } else if ((inv.cgst_amount && inv.cgst_amount > 0) || (inv.sgst_amount && inv.sgst_amount > 0)) {
        rate = Math.round(((inv.cgst_amount || 0) + (inv.sgst_amount || 0)) / inv.taxable_amount * 100);
      }
    }

    return [
      inv.customer_gstin || '',
      inv.invoice_number,
      inv.invoice_date || '',
      inv.total_invoice || 0,
      pos,
      'N', // Reverse Charge
      inv.supply_type || 'B2B', // Invoice Type (Regular, B2C, etc)
      rate,
      inv.taxable_amount || 0,
      inv.igst_amount || 0,
      inv.cgst_amount || 0,
      inv.sgst_amount || 0,
      0 // Cess
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
