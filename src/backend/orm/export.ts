import { supabase } from '../../lib/supabase/client';

export type GSTR1ExportRow = {
  org_id: string;
  invoice_number: string;
  invoice_date: string;
  recipient_name: string;
  taxable_value: number;
  gst_rate_pct: number;
  gst_amount: number;
  total_invoice_value: number;
  pos_state: string;
  item_type: 'Goods' | 'Services';
};

export type GSTR3BExportRow = {
  org_id: string;
  nature_of_supplies: string;
  total_taxable_value: number;
  total_tax_liability: number;
  total_itc: number;
};

export const ExportORM = {
  async getGSTR1(orgId: string): Promise<GSTR1ExportRow[]> {
    const { data, error } = await (supabase as any)
      .from('v_gstr1_export')
      .select('*')
      .eq('org_id', orgId);
    
    if (error) throw error;
    return data as GSTR1ExportRow[];
  },

  async getGSTR3B(orgId: string): Promise<GSTR3BExportRow[]> {
    const { data, error } = await (supabase as any)
      .from('v_gstr3b_export')
      .select('*')
      .eq('org_id', orgId);
      
    if (error) throw error;
    return data as GSTR3BExportRow[];
  }
};
