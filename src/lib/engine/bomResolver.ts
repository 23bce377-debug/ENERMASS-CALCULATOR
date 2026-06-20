import { safeEvalFormula, FormulaVariables } from './formulaParser';
import type { CachedBomTemplateItem, CachedBomCategory } from '@/lib/cache/masterCacheTypes';
// Assuming BomItem structure based on standard needs, you might need to adjust based on exact type in codebase
export interface BomItem {
  id?: string;
  item: string;
  description?: string;
  qty: number;
  unit: string;
  rate: number;
  gst_pct: number;
  isSurveyDependent?: boolean;
}

export interface BomResolutionContext {
  systemKW: number;
  panelCount: number;
  inverterCount: number;
  batteryCount: number;
  stringCount?: number;
  dcCableLengthM?: number;
  acCableLengthM?: number;
  phase?: 1 | 3;
  structureType?: string;
}

export interface ResolvedBomItem extends BomItem {
  templateItemId: string;
  categoryId: string;
  categoryName: string;
  resolvedFromFormula: boolean;
  formulaExpression: string | null;
}

export function resolveBomTemplateItem(
  templateItem: CachedBomTemplateItem,
  category: CachedBomCategory,
  context: BomResolutionContext,
  rateOverride?: number
): ResolvedBomItem | null {
  const variables: FormulaVariables = {
    system_kw: context.systemKW,
    panel_count: context.panelCount,
    inverter_count: context.inverterCount,
    battery_count: context.batteryCount,
    string_count: context.stringCount,
    dc_cable_length: context.dcCableLengthM,
    ac_cable_length: context.acCableLengthM,
  };

  let qty = 1;
  let resolvedFromFormula = false;

  if (templateItem.qty_formula) {
    try {
      qty = safeEvalFormula(templateItem.qty_formula, variables);
      resolvedFromFormula = true;
    } catch (e) {
      console.warn(`Formula evaluation failed for item ${templateItem.sku_code}: ${e}`);
      return null;
    }
  }

  if (qty <= 0) {
    return null; // Exclude items with 0 qty
  }

  const rate = rateOverride !== undefined ? rateOverride : (templateItem.default_rate || 0);

  return {
    templateItemId: templateItem.id,
    categoryId: category.id,
    categoryName: category.name,
    resolvedFromFormula,
    formulaExpression: templateItem.qty_formula,
    item: templateItem.sku_code,
    description: templateItem.description,
    qty,
    unit: templateItem.unit,
    rate,
    gst_pct: 18, // Default fallback, adjust if category has specific gst
    isSurveyDependent: templateItem.is_survey_dependent
  };
}

export function resolveAllBomItems(
  templateItems: CachedBomTemplateItem[],
  categories: CachedBomCategory[],
  context: BomResolutionContext,
  rateOverrides?: Record<string, number>
): ResolvedBomItem[] {
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const resolved: ResolvedBomItem[] = [];

  for (const item of templateItems) {
    const category = categoryMap.get(item.category_id);
    if (!category) continue;

    const rateOverride = rateOverrides ? rateOverrides[item.sku_code] : undefined;
    const resolvedItem = resolveBomTemplateItem(item, category, context, rateOverride);

    if (resolvedItem) {
      resolved.push(resolvedItem);
    }
  }

  return resolved;
}
