/**
 * ENERMASS Solar Calculator — Quote Types
 * ========================================
 * Complete data structures for sales quotes.
 * Re-exports calculator types used within the Quote.
 */

import type {
  AdditionalCost,
  DiscountType,
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
  execName: string;
  notes: string;
  saleType: 'New' | 'Upgrade' | 'Referral';
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
  };

  // Pricing adjustments
  additionalCosts: AdditionalCost[];
  discountType: DiscountType;
  discountVal: number;
  overrides: Record<number, RowOverride>;
  targetMarginPct?: number;
  customItems?: import('../data/bom').BomItem[];

  // Frozen calculation snapshot at quote creation
  calculations: CalcResult;

  // Lifecycle
  status: 'Draft' | 'Sent' | 'Won' | 'Lost';
  statusHistory?: QuoteStatusEntry[];
  createdAt: string;
  updatedAt: string;
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
