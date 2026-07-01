/**
 * ENERMASS Solar Calculator — Quote Types
 * ========================================
 * Complete data structures for sales quotes.
 * Re-exports calculator types used within the Quote.
 */

import type {
  AdditionalCost,
  DiscountType,
  MarginMode,
  RowOverride,
  CalcResult,
} from '../engine/calculator';

// Re-export for convenience
export type { AdditionalCost, DiscountType, RowOverride, CalcResult };

// ─── Customer & Site Sub-Structures ─────────────────────────────────────────────

export interface CustomerInfo {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  isGstRegistered?: boolean;
}

export interface AddressInfo {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pin: string;
}

export interface SiteInfo {
  meterNo: string;
  sanctionedLoad: string;
  monthlyBill: number;
  roofType: 'RCC' | 'Metal Sheet' | 'Tin' | 'Other';
  roofArea: number;
}

export interface SalesInfo {
  projectTitle: string;
  execName: string;
  notes: string;
  saleType: 'New' | 'Upgrade' | 'Referral';
  itcEligible?: boolean;
}

export interface QuoteStatusEntry {
  status: 'Draft' | 'Sent' | 'Won' | 'Lost';
  changedAt: string;
}

export interface QuotePanelMixEntry {
  panelBrandId: string;
  qty: number;
}

export interface QuoteEquipmentMixEntry {
  inverterBrandId?: string;
  batteryBrandId?: string;
  qty: number;
}

// ─── Main Quote Interface ───────────────────────────────────────────────────────

export interface Quote {
  dbId?: string;
  quoteId: string;
  date: string;
  projectType: 'residential' | 'commercial';

  // Stakeholder info
  customer: CustomerInfo;
  address: AddressInfo;
  site: SiteInfo;
  sales: SalesInfo;

  // System selection
  systemId: string;
  systemName: string;
  category: string;
  selectedState: string;
  systemCapacityKW?: number;
  panelQty?: number;
  panelBrandModel?: string;

  // Equipment brand selections
  equipment: {
    panelBrandId?: string;
    panelMix?: QuotePanelMixEntry[];
    panelRate?: number;
    inverterBrandId?: string;
    inverterMix?: Array<{ inverterBrandId: string; qty: number }>;
    inverterRate?: number;
    batteryBrandId?: string;
    batteryMix?: Array<{ batteryBrandId: string; qty: number }>;
    batteryRate?: number;
    roundOffToThousand?: boolean;
    unroundedFinalCustomerPrice?: number;
    roundOffAdjustment?: number;
    marginMode?: MarginMode;
    targetMarginAmount?: number;
  };

  // Pricing adjustments
  additionalCosts: AdditionalCost[];
  discountType: DiscountType;
  discountVal: number;
  overrides: Record<number, RowOverride>;
  marginMode?: MarginMode;
  targetMarginPct?: number;
  targetMarginAmount?: number;
  customItems?: import('../data/bom').BomItem[];
  disabledItemIndices?: Record<number, boolean>;
  gstOnOutputOverride?: number | null;
  targetMRPInclGST?: number | null;
  targetMRPPerWatt?: number | null;
  roundOffToThousand?: boolean;

  // Frozen calculation snapshot at quote creation
  calculations: CalcResult;

  // Lifecycle
  status: 'Draft' | 'Sent' | 'Won' | 'Lost';
  statusHistory?: QuoteStatusEntry[];
  createdAt: string;
  updatedAt: string;
  version?: number;
  parentQuoteId?: string;

  // Custom/Editable details
  company_cin?: string;
  company_gstin?: string;
  company_pan?: string;
  company_phone?: string;
  company_email?: string;
  company_website?: string;
  company_address?: string;
  ceo_name?: string;
  ceo_designation?: string;
  ceo_signature_url?: string;
  sales_exec_role?: string;
  sales_exec_phone?: string;
  sales_exec_email?: string;
  sales_exec_id?: string;
  bank_account_holder?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_upi_id?: string;
  terms_json?: string[];
  why_solar_json?: {
    benefits?: string[];
    reasons?: string[];
    warranties?: string[];
    promises?: string[];
  };
}

// ─── Quote ID Generator ─────────────────────────────────────────────────────────

/**
 * Generate a unique quote ID in the format: QT-YYYYMMDD-XXXX
 * where XXXX is a 4-character random alphanumeric string.
 */
export function generateQuoteId(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `QT-${datePart}-${random}`;
}
