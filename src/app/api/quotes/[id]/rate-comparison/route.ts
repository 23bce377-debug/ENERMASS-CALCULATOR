import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CurrentRate = {
  label: string;
  rate: number;
  gstPct?: number;
  sourceTable?: string;
  sourceItemId?: string;
  matchedBy?: 'source' | 'description';
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function labelFromParts(...parts: Array<unknown>) {
  return parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
    .filter(Boolean)
    .join(' ');
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function lineTotal(rate: number, qty: number, gstPct: number) {
  return roundMoney(rate * qty * (1 + gstPct));
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isDescriptionMatch(candidate: string, needle: string) {
  const normalizedCandidate = normalizeText(candidate);
  const normalizedNeedle = normalizeText(needle);
  if (!normalizedCandidate || !normalizedNeedle) return false;
  return normalizedCandidate === normalizedNeedle ||
    normalizedCandidate.includes(normalizedNeedle) ||
    normalizedNeedle.includes(normalizedCandidate);
}

async function fetchCurrentRate(supabase: any, sourceTable: string, sourceItemId: string): Promise<CurrentRate | null> {
  switch (sourceTable) {
    case 'eq_panels': {
      const { data, error } = await supabase
        .from('eq_panels')
        .select('brand, model, wattage_w, selling_price, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: labelFromParts(data.brand, data.model, `(${data.wattage_w}W)`),
        rate: Number(data.selling_price || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'eq_inverters': {
      const { data, error } = await supabase
        .from('eq_inverters')
        .select('brand, model, capacity_kw, selling_price, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: labelFromParts(data.brand, data.model, `(${data.capacity_kw}kW)`),
        rate: Number(data.selling_price || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'eq_batteries': {
      const { data, error } = await supabase
        .from('eq_batteries')
        .select('brand, model, capacity_kwh, selling_price, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: labelFromParts(data.brand, data.model, `(${data.capacity_kwh}kWh)`),
        rate: Number(data.selling_price || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'eq_meters': {
      const { data, error } = await supabase
        .from('eq_meters')
        .select('brand, model, meter_type, selling_price, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: labelFromParts(data.brand, data.model, `(${data.meter_type})`),
        rate: Number(data.selling_price || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'eq_lightning_arresters': {
      const { data, error } = await supabase
        .from('eq_lightning_arresters')
        .select('brand, model, selling_price, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: labelFromParts(data.brand, data.model),
        rate: Number(data.selling_price || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'eq_mounting_structures': {
      const { data, error } = await supabase
        .from('eq_mounting_structures')
        .select('name, selling_price, rate_per_kg, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: data.name || 'Mounting Structure',
        rate: Number(data.selling_price ?? data.rate_per_kg ?? 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'bom_template_items': {
      const { data, error } = await supabase
        .from('bom_template_items')
        .select('description, default_rate, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: data.description || 'BOM Item',
        rate: Number(data.default_rate || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'eq_communication_devices': {
      const { data, error } = await supabase
        .from('eq_communication_devices')
        .select('brand, model, selling_price, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: labelFromParts(data.brand, data.model),
        rate: Number(data.selling_price || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'structure_component_master': {
      const { data, error } = await supabase
        .from('structure_component_master')
        .select('name, selling_price, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: data.name || 'Structure Component',
        rate: Number(data.selling_price || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'eq_structure_components': {
      const { data, error } = await supabase
        .from('eq_structure_components')
        .select('name, selling_price, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: data.name || 'Structure Component',
        rate: Number(data.selling_price || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    case 'eq_structure_addons': {
      const { data, error } = await supabase
        .from('eq_structure_addons')
        .select('name, rate_per_unit, gst_pct')
        .eq('id', sourceItemId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        label: data.name || 'Structure Add-on',
        rate: Number(data.rate_per_unit || 0),
        gstPct: Number(data.gst_pct || 0),
        sourceTable,
        sourceItemId,
        matchedBy: 'source',
      };
    }
    default:
      return null;
  }
}

async function findCurrentRateByDescription(supabase: any, description: string, section: string): Promise<CurrentRate | null> {
  const priorities: Record<string, string[]> = {
    solar_panels: ['eq_panels', 'bom_template_items'],
    power_electronics: ['eq_inverters', 'eq_batteries', 'eq_communication_devices', 'bom_template_items'],
    mounting_structure: ['eq_mounting_structures', 'structure_component_master', 'eq_structure_components', 'eq_structure_addons', 'bom_template_items'],
    electrical_protection: ['bom_template_items'],
    earthing: ['bom_template_items'],
    cabling: ['bom_template_items'],
    wiring: ['eq_lightning_arresters', 'bom_template_items'],
    metering: ['eq_meters', 'bom_template_items'],
    services: ['bom_template_items'],
  };

  const tables = priorities[section] || ['bom_template_items'];

  for (const table of tables) {
    if (table === 'bom_template_items') {
      const { data } = await supabase
        .from('bom_template_items')
        .select('id, description, default_rate, gst_pct')
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(row.description, description));
      if (match) {
        return {
          label: match.description || 'BOM Item',
          rate: Number(match.default_rate || 0),
          gstPct: Number(match.gst_pct || 0),
          sourceTable: table,
          sourceItemId: match.id,
          matchedBy: 'description',
        };
      }
    }

    if (table === 'eq_panels') {
      const { data } = await supabase
        .from('eq_panels')
        .select('id, brand, model, wattage_w, selling_price, gst_pct')
        .eq('is_active', true)
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(labelFromParts(row.brand, row.model, `(${row.wattage_w}W)`), description));
      if (match) return { label: labelFromParts(match.brand, match.model, `(${match.wattage_w}W)`), rate: Number(match.selling_price || 0), gstPct: Number(match.gst_pct || 0), sourceTable: table, sourceItemId: match.id, matchedBy: 'description' };
    }

    if (table === 'eq_inverters') {
      const { data } = await supabase
        .from('eq_inverters')
        .select('id, brand, model, capacity_kw, selling_price, gst_pct')
        .eq('is_active', true)
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(labelFromParts(row.brand, row.model, `(${row.capacity_kw}kW)`), description));
      if (match) return { label: labelFromParts(match.brand, match.model, `(${match.capacity_kw}kW)`), rate: Number(match.selling_price || 0), gstPct: Number(match.gst_pct || 0), sourceTable: table, sourceItemId: match.id, matchedBy: 'description' };
    }

    if (table === 'eq_batteries') {
      const { data } = await supabase
        .from('eq_batteries')
        .select('id, brand, model, capacity_kwh, selling_price, gst_pct')
        .eq('is_active', true)
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(labelFromParts(row.brand, row.model, `(${row.capacity_kwh}kWh)`), description));
      if (match) return { label: labelFromParts(match.brand, match.model, `(${match.capacity_kwh}kWh)`), rate: Number(match.selling_price || 0), gstPct: Number(match.gst_pct || 0), sourceTable: table, sourceItemId: match.id, matchedBy: 'description' };
    }

    if (table === 'eq_meters') {
      const { data } = await supabase
        .from('eq_meters')
        .select('id, brand, model, meter_type, selling_price, gst_pct')
        .eq('is_active', true)
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(labelFromParts(row.brand, row.model, row.meter_type), description));
      if (match) return { label: labelFromParts(match.brand, match.model, `(${match.meter_type})`), rate: Number(match.selling_price || 0), gstPct: Number(match.gst_pct || 0), sourceTable: table, sourceItemId: match.id, matchedBy: 'description' };
    }

    if (table === 'eq_lightning_arresters') {
      const { data } = await supabase
        .from('eq_lightning_arresters')
        .select('id, brand, model, selling_price, gst_pct')
        .eq('is_active', true)
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(labelFromParts(row.brand, row.model), description));
      if (match) return { label: labelFromParts(match.brand, match.model), rate: Number(match.selling_price || 0), gstPct: Number(match.gst_pct || 0), sourceTable: table, sourceItemId: match.id, matchedBy: 'description' };
    }

    if (table === 'eq_communication_devices') {
      const { data } = await supabase
        .from('eq_communication_devices')
        .select('id, brand, model, selling_price, gst_pct')
        .eq('is_active', true)
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(labelFromParts(row.brand, row.model), description));
      if (match) return { label: labelFromParts(match.brand, match.model), rate: Number(match.selling_price || 0), gstPct: Number(match.gst_pct || 0), sourceTable: table, sourceItemId: match.id, matchedBy: 'description' };
    }

    if (table === 'eq_mounting_structures') {
      const { data } = await supabase
        .from('eq_mounting_structures')
        .select('id, name, selling_price, rate_per_kg, gst_pct')
        .eq('is_active', true)
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(row.name, description));
      if (match) return { label: match.name || 'Mounting Structure', rate: Number(match.selling_price ?? match.rate_per_kg ?? 0), gstPct: Number(match.gst_pct || 0), sourceTable: table, sourceItemId: match.id, matchedBy: 'description' };
    }

    if (table === 'structure_component_master' || table === 'eq_structure_components') {
      const { data } = await supabase
        .from(table)
        .select('id, name, selling_price, gst_pct')
        .eq('is_active', true)
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(row.name, description));
      if (match) return { label: match.name || 'Structure Component', rate: Number(match.selling_price || 0), gstPct: Number(match.gst_pct || 0), sourceTable: table, sourceItemId: match.id, matchedBy: 'description' };
    }

    if (table === 'eq_structure_addons') {
      const { data } = await supabase
        .from('eq_structure_addons')
        .select('id, name, rate_per_unit, gst_pct')
        .eq('is_active', true)
        .limit(200);
      const match = (data || []).find((row: any) => isDescriptionMatch(row.name, description));
      if (match) return { label: match.name || 'Structure Add-on', rate: Number(match.rate_per_unit || 0), gstPct: Number(match.gst_pct || 0), sourceTable: table, sourceItemId: match.id, matchedBy: 'description' };
    }
  }

  return null;
}

const SECTION_LABELS: Record<string, string> = {
  solar_panels: 'Solar Panels',
  power_electronics: 'Power Electronics',
  mounting_structure: 'Mounting Structure',
  electrical_protection: 'Electrical Protection',
  earthing: 'Earthing & Protection',
  cabling: 'Cables',
  wiring: 'Conduits & Wiring',
  metering: 'Metering & Monitoring',
  services: 'Engineering Services',
};

export const GET = withLicensedApiRoute<RouteContext>(
  async (_request, context) => {
    const { id } = await context.route.params;
    const orgId = context.session.orgId;
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    let query = supabase
      .from('quotes')
      .select('id, quote_number, org_id, created_at, final_customer_price, mrp_incl_gst, quote_items(*)')
      .eq('org_id', orgId);

    query = UUID_RE.test(id) ? query.eq('id', id) : query.eq('quote_number', id);

    const { data: quote, error } = await query.maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const rows = await Promise.all(
      (quote.quote_items || []).map(async (item: any) => {
        const qty = Number(item.qty || 0);
        const quotedRate = Number(item.rate_per_unit || 0);
        const quotedGstPct = Number(item.gst_pct || 0);
        const sourceTable = item.source_table || null;
        const sourceItemId = item.source_item_id || null;
        const section = item.section || 'services';
        const isIncluded = item.is_included !== false;
        const current = sourceTable && sourceItemId
          ? await fetchCurrentRate(supabase, sourceTable, sourceItemId)
          : await findCurrentRateByDescription(supabase, item.description, section);

        const currentRate = current?.rate ?? null;
        const currentGstPct = current?.gstPct ?? null;
        const quotedSubtotal = Number(item.line_total ?? 0) > 0
          ? roundMoney(Number(item.line_total || 0))
          : roundMoney(quotedRate * qty);
        const quotedTotal = Number(item.line_subtotal ?? 0) > 0
          ? roundMoney(Number(item.line_subtotal || 0))
          : lineTotal(quotedRate, qty, quotedGstPct);
        const currentSubtotal = currentRate === null ? null : roundMoney(currentRate * qty);
        const currentTotal = currentRate === null || currentGstPct === null
          ? null
          : lineTotal(currentRate, qty, currentGstPct);
        const deltaRate = currentRate === null ? null : roundMoney(currentRate - quotedRate);
        const deltaGstPct = currentGstPct === null ? null : roundMoney(currentGstPct - quotedGstPct);
        const deltaTotal = currentTotal === null ? null : roundMoney(currentTotal - quotedTotal);
        const status =
          currentRate === null
            ? sourceTable && sourceItemId
              ? 'missing'
              : 'unlinked'
            : Math.abs(deltaTotal || 0) < 0.01
              ? 'same'
              : 'changed';

        return {
          id: item.id,
          sortOrder: item.sort_order,
          description: item.description,
          section,
          sourceTable: sourceTable || current?.sourceTable || null,
          sourceItemId: sourceItemId || current?.sourceItemId || null,
          sourceLabel: item.source_label || current?.label || null,
          matchedBy: current?.matchedBy || null,
          qty,
          unit: item.unit || 'Nos',
          isIncluded,
          quotedRate,
          quotedGstPct,
          originalRate: item.original_rate === null || item.original_rate === undefined ? null : Number(item.original_rate),
          originalGstPct: item.original_gst === null || item.original_gst === undefined ? null : Number(item.original_gst),
          quotedSubtotal,
          quotedTotal,
          currentRate,
          currentGstPct,
          currentSubtotal,
          currentTotal,
          deltaRate,
          deltaGstPct,
          deltaTotal,
          status,
        };
      })
    );

    // Only consider included + linked rows for summary
    const includedRows = rows.filter((r) => r.isIncluded);
    const linkedRows = includedRows.filter((r) => r.currentRate !== null);
    const quotedTotal = linkedRows.reduce((sum, r) => sum + r.quotedTotal, 0);
    const currentTotal = linkedRows.reduce((sum, r) => sum + (r.currentTotal ?? 0), 0);
    const deltaTotal = currentTotal - quotedTotal;
    const deltaPct = quotedTotal > 0 ? (deltaTotal / quotedTotal) * 100 : 0;
    const verdict: 'profit' | 'loss' | 'neutral' =
      deltaTotal < -0.5 ? 'profit' : deltaTotal > 0.5 ? 'loss' : 'neutral';

    // Section breakdown
    const sectionMap = new Map<string, { quoted: number; current: number }>();
    for (const row of linkedRows) {
      const existing = sectionMap.get(row.section) || { quoted: 0, current: 0 };
      existing.quoted += row.quotedTotal;
      existing.current += row.currentTotal ?? 0;
      sectionMap.set(row.section, existing);
    }
    const sectionBreakdown = Array.from(sectionMap.entries())
      .map(([section, totals]) => ({
        section,
        sectionLabel: SECTION_LABELS[section] || section,
        quotedTotal: totals.quoted,
        currentTotal: totals.current,
        deltaTotal: totals.current - totals.quoted,
      }))
      .sort((a, b) => Math.abs(b.deltaTotal) - Math.abs(a.deltaTotal));

    // Top movers: items with largest absolute delta
    const topMovers = linkedRows
      .filter((r) => r.status === 'changed' && r.deltaTotal !== null)
      .sort((a, b) => Math.abs(b.deltaTotal!) - Math.abs(a.deltaTotal!))
      .slice(0, 5)
      .map((r) => ({
        description: r.description,
        sourceLabel: r.sourceLabel,
        deltaTotal: r.deltaTotal!,
        direction: (r.deltaTotal! > 0 ? 'up' : 'down') as 'up' | 'down',
      }));

    return NextResponse.json({
      quoteId: quote.quote_number,
      quoteDbId: quote.id,
      quoteDate: quote.created_at,
      customerPrice: quote.final_customer_price || quote.mrp_incl_gst || 0,
      verdict,
      summary: {
        linkedCount: linkedRows.length,
        unlinkedCount: includedRows.length - linkedRows.length,
        changedCount: linkedRows.filter((r) => r.status === 'changed').length,
        quotedTotal,
        currentTotal,
        deltaTotal,
        deltaPct: Math.round(deltaPct * 100) / 100,
      },
      topMovers,
      sectionBreakdown,
      rows: includedRows,
    });
  },
  { feature: 'calculator', roles: ['owner', 'admin', 'manager', 'staff'] }
);
