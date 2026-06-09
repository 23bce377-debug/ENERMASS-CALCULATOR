export interface BundlePreset {
  id: string;
  org_id: string;
  vendor_id?: string | null;
  name: string;
  effective_bundle_price: number;
  allocation_strategy: 'proportional_cost' | 'proportional_qty' | 'manual';
  notes?: string | null;
  is_active: boolean;
  gst_pct?: number | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  
  // Optional relations
  bundle_preset_items?: BundlePresetItem[];
  vendors?: { name: string };
}

export interface BundlePresetItem {
  id: string;
  bundle_preset_id: string;
  item_description: string;
  category: string; // bom_section value
  qty: number;
  unit: string;
  base_cost: number;
  allocated_cost_override?: number | null;
  gst_pct: number;
  created_at: string;
}

export interface AcquisitionBundle {
  id: string;
  acquisition_id: string;
  bundle_preset_id?: string | null;
  name: string;
  qty: number;
  effective_bundle_price: number;
  allocation_strategy: 'proportional_cost' | 'proportional_qty' | 'manual';
  gst_pct: number;
  created_at: string;
}
