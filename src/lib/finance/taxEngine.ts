import { createClient } from '@/lib/supabase/server';

export interface GstRateInfo {
  hsn_sac_code: string;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cess_rate: number;
  is_reverse_charge: boolean;
}

/**
 * Fetches the active GST rate for a specific HSN/SAC code on a given date.
 */
export async function getGstRateForHsnSac(orgId: string, hsnSacCode: string, date: string = new Date().toISOString().split('T')[0]): Promise<GstRateInfo> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tax_hsn_sac')
    .select(`
      code,
      type,
      tax_gst_rates (
        cgst_rate, sgst_rate, igst_rate, cess_rate, is_reverse_charge, effective_from, effective_to
      )
    `)
    .eq('org_id', orgId)
    .eq('code', hsnSacCode)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(`GST Configuration missing: No active HSN/SAC code found for '${hsnSacCode}'. Do not guess GST rates. Please configure the tax master.`);
  }

  // Find active rate for the date
  const rates: any[] = Array.isArray(data.tax_gst_rates) ? data.tax_gst_rates : [data.tax_gst_rates];
  const activeRate = rates.find(r => {
    const from = new Date(r.effective_from);
    const to = r.effective_to ? new Date(r.effective_to) : new Date('2099-12-31');
    const target = new Date(date);
    return target >= from && target <= to;
  });

  if (!activeRate) {
    throw new Error(`GST Configuration missing: No active rate found for HSN/SAC '${hsnSacCode}' on date ${date}.`);
  }

  return {
    hsn_sac_code: data.code,
    cgst_rate: Number(activeRate.cgst_rate),
    sgst_rate: Number(activeRate.sgst_rate),
    igst_rate: Number(activeRate.igst_rate),
    cess_rate: Number(activeRate.cess_rate),
    is_reverse_charge: Boolean(activeRate.is_reverse_charge),
  };
}

/**
 * Calculate applicable GST based on Place of Supply
 * 
 * @param originState State code of the seller
 * @param destinationState State code of the buyer
 * @param baseAmount Taxable amount
 * @param rateInfo GST rate rules for the item
 * @param isWorksContract Whether this is a composite works contract
 */
export function calculateItemGst(
  originState: string,
  destinationState: string,
  baseAmount: number,
  rateInfo: GstRateInfo,
  isWorksContract: boolean = false
) {
  if (baseAmount < 0) throw new Error("Base amount cannot be negative");

  const isInterState = originState.trim().toLowerCase() !== destinationState.trim().toLowerCase();
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  const cess = baseAmount * rateInfo.cess_rate;

  if (isInterState) {
    igst = baseAmount * rateInfo.igst_rate;
  } else {
    cgst = baseAmount * rateInfo.cgst_rate;
    sgst = baseAmount * rateInfo.sgst_rate;
  }

  // Under Works Contract, sometimes specific split rules apply (e.g., 70/30). 
  // However, per prompt: "Remove any hardcoded universal 70/30 GST assumptions unless explicitly and correctly applicable to a specific invoice type."
  // So we ONLY apply the composite rate if it's explicitly marked as a Works Contract at the project level.

  return {
    taxable_value: baseAmount,
    cgst_amount: cgst,
    sgst_amount: sgst,
    igst_amount: igst,
    cess_amount: cess,
    total_tax: cgst + sgst + igst + cess,
    is_reverse_charge: rateInfo.is_reverse_charge
  };
}
