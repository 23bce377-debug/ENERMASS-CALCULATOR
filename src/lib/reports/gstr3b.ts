import { Database } from '../types/schema.types';

type Invoice = Database['public']['Tables']['acc_invoices']['Row'];
type VendorPayment = any;

export interface GSTR3BSummary {
  outwardSupplies: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    totalTax: number;
  };
  itcAvailable: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    totalTax: number;
  };
  netPayable: {
    igst: number;
    cgst: number;
    sgst: number;
    total: number;
  };
}

export function generateGSTR3BSummary(
  invoices: Invoice[],
  vendorPayments: VendorPayment[]
): GSTR3BSummary {
  // Table 3.1: Outward taxable supplies
  const outward = invoices.reduce(
    (acc, inv) => {
      acc.taxableValue += inv.taxable_amount || 0;
      acc.igst += inv.igst_amount || 0;
      acc.cgst += inv.cgst_amount || 0;
      acc.sgst += inv.sgst_amount || 0;
      return acc;
    },
    { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, totalTax: 0 }
  );
  outward.totalTax = outward.igst + outward.cgst + outward.sgst;

  // Table 4: Eligible ITC
  const itc = vendorPayments.reduce(
    (acc, vp) => {
      acc.taxableValue += vp.taxable_amount || 0;
      acc.igst += vp.igst_amount || 0;
      acc.cgst += vp.cgst_amount || 0;
      acc.sgst += vp.sgst_amount || 0;
      return acc;
    },
    { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, totalTax: 0 }
  );
  itc.totalTax = itc.igst + itc.cgst + itc.sgst;

  // Net Payable
  const netIgst = Math.max(0, outward.igst - itc.igst);
  const netCgst = Math.max(0, outward.cgst - itc.cgst);
  const netSgst = Math.max(0, outward.sgst - itc.sgst);
  
  // Note: Standard GST offsetting rules allow IGST credit to be used against CGST/SGST,
  // but for simplicity of this summary, we just show raw offset. In real-world, 
  // you'd waterfall the IGST credit.
  const totalPayable = netIgst + netCgst + netSgst;

  return {
    outwardSupplies: outward,
    itcAvailable: itc,
    netPayable: {
      igst: netIgst,
      cgst: netCgst,
      sgst: netSgst,
      total: totalPayable
    }
  };
}
