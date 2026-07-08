export const PRESET_TOP_CATEGORIES = [
  'panel',
  'inverter',
  'battery',
  'structure',
  'bom_item',
  'miscellaneous',
] as const;

export type PresetTopCategory = (typeof PRESET_TOP_CATEGORIES)[number];

export const TOP_CATEGORY_LABELS: Record<PresetTopCategory, string> = {
  panel: 'Panels',
  inverter: 'Inverters',
  battery: 'Batteries',
  structure: 'Structures',
  bom_item: 'BOM Items',
  miscellaneous: 'Miscellaneous',
};

export const EXCEL_BOM_SUBCATEGORIES = [
  'Cables & Conduit',
  'AC Protection',
  'DC Protection',
  'Earthing',
  'LA & Earthings',
  'Monitoring & Safety',
  'Meter Boxes',
  'Cables & Wires',
  'Civil Works',
  'Wiring Accessories',
] as const;

const BOM_ITEM_SUBCATEGORY_KEYS = new Set(
  EXCEL_BOM_SUBCATEGORIES.map((subcategory) => normalizeTaxonomyKey(subcategory))
);

export const FUNCTIONAL_CATEGORY_LABELS: Record<string, string> = {
  all: 'All Saved Items',
  panel: 'Panels',
  inverter: 'Inverters',
  battery: 'Batteries',
  structure: 'Structures',
  bom_item: 'BOM Items',
  dc_protection: 'DC Protection',
  ac_protection: 'AC Protection',
  cable: 'Cables',
  earthing: 'Earthing',
  civil: 'Civil Works',
  logistics: 'Logistics',
  accessory: 'Accessories',
  miscellaneous: 'Miscellaneous',
};

const CORE_FUNCTIONAL_CATEGORIES = new Set(['panel', 'inverter', 'battery', 'structure']);
const BOM_FUNCTIONAL_CATEGORIES = new Set([
  'dc_protection',
  'ac_protection',
  'cable',
  'earthing',
  'civil',
  'logistics',
  'accessory',
  'bom_item',
  'miscellaneous',
]);

export function normalizeTaxonomyKey(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeFunctionalCategory(category: string | null | undefined) {
  const normalized = normalizeTaxonomyKey(category);
  if (!normalized || normalized === 'other' || normalized === 'misc') return 'miscellaneous';
  if (normalized === 'panels') return 'panel';
  if (normalized === 'inverters') return 'inverter';
  if (normalized === 'batteries') return 'battery';
  if (normalized === 'structures' || normalized === 'mounting_structure') return 'structure';
  if (normalized === 'bom_items' || normalized === 'bom') return 'bom_item';
  if (normalized === 'accessories' || normalized === 'monitoring_and_safety' || normalized === 'wiring_accessories' || normalized === 'meter_boxes') return 'accessory';
  if (normalized === 'cables_and_conduit' || normalized === 'cables_and_wires' || normalized === 'cabling' || normalized === 'wiring') return 'cable';
  if (normalized === 'dc_side_protection') return 'dc_protection';
  if (normalized === 'ac_side_protection') return 'ac_protection';
  if (normalized === 'civil_works' || normalized === 'services') return 'civil';
  if (normalized === 'logistics_and_handling' || normalized === 'handling') return 'logistics';
  if (normalized === 'earthings' || normalized === 'la_and_earthings') return 'earthing';
  return BOM_FUNCTIONAL_CATEGORIES.has(normalized) || CORE_FUNCTIONAL_CATEGORIES.has(normalized)
    ? normalized
    : 'miscellaneous';
}

export function isBomItemSubcategory(value: string | null | undefined) {
  return BOM_ITEM_SUBCATEGORY_KEYS.has(normalizeTaxonomyKey(value));
}

export function topCategoryFromFunctional(category: string | null | undefined): PresetTopCategory {
  const normalized = normalizeFunctionalCategory(category);
  if (normalized === 'panel' || normalized === 'inverter' || normalized === 'battery' || normalized === 'structure') {
    return normalized;
  }
  if (normalized === 'miscellaneous') return 'miscellaneous';
  return 'bom_item';
}

export function functionalCategoryFromTop(topCategory: string | null | undefined, fallback = 'miscellaneous') {
  const normalized = normalizeTaxonomyKey(topCategory);
  if (normalized === 'panel' || normalized === 'inverter' || normalized === 'battery' || normalized === 'structure') {
    return normalized;
  }
  if (normalized === 'bom_item' || normalized === 'bom_items') return normalizeFunctionalCategory(fallback) === 'miscellaneous'
    ? 'accessory'
    : normalizeFunctionalCategory(fallback);
  return 'miscellaneous';
}

export function defaultSubcategoryForItem(item: {
  topCategory?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  model?: string | null;
  categoryName?: string | null;
}) {
  if (item.subcategory?.trim()) return item.subcategory.trim();
  const topCategory = item.topCategory ? normalizeTaxonomyKey(item.topCategory) : topCategoryFromFunctional(item.category);
  if (topCategory === 'panel' || topCategory === 'inverter' || topCategory === 'battery') {
    return item.brand?.trim() || 'Unbranded';
  }
  if (topCategory === 'structure') {
    return item.categoryName?.trim() || 'Structure & Accessories';
  }
  if (topCategory === 'bom_item') {
    return item.categoryName?.trim() || FUNCTIONAL_CATEGORY_LABELS[normalizeFunctionalCategory(item.category)] || 'Miscellaneous';
  }
  return item.categoryName?.trim() || 'Miscellaneous';
}

export function isCoreTopCategory(topCategory: string | null | undefined) {
  const normalized = normalizeTaxonomyKey(topCategory);
  return normalized === 'panel' || normalized === 'inverter' || normalized === 'battery' || normalized === 'structure';
}
