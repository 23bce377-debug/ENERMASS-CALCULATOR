import { StateCreator } from 'zustand';
import {
  CalculatorState,
  getAllSystemsFromSettings,
  normalizeMixEntries,
  runCalculation
} from '../calculatorTypes';
import {
  type Quote,
  type CustomerInfo,
  type AddressInfo,
  type SiteInfo,
  type SalesInfo,
  generateQuoteId
} from '../../types/quote';

export const createQuoteSlice: StateCreator<
  CalculatorState,
  [],
  [],
  Pick<CalculatorState, 'quotes' | 'activeQuoteId' | 'saveQuote' | 'loadQuote' | 'duplicateQuote'>
> = (set, get) => ({
  quotes: [],
  activeQuoteId: null,

  saveQuote: async (
    info: {
      customer: CustomerInfo;
      address: AddressInfo;
      site: SiteInfo;
      sales: SalesInfo;
    },
    forceOverwrite?: boolean
  ): Promise<Quote> => {
    const state = get();

    if (!state.selectedSystemId || !state.calcResult) {
      throw new Error('Cannot save quote: no system selected or calculation missing.');
    }

    const { supabase } = await import('../../supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Unauthorized');

    const { ProfileORM } = await import('../../../backend/orm/profile');
    const profile = await ProfileORM.getById(session.user.id);
    const orgId = profile.org_id;

    // Resolve system metadata
    const system = getAllSystemsFromSettings(state.dbLoaded, state.dbSystems).find((s) => s.id === state.selectedSystemId);
    if (!system) {
      throw new Error(`System not found: "${state.selectedSystemId}"`);
    }

    const now = new Date().toISOString();
    const panelMixEntries = Object.entries(state.panelMix)
      .filter(([, qty]) => Number.isFinite(qty) && qty > 0)
      .map(([panelBrandId, qty]) => ({ panelBrandId, qty }));

    const inverterMixEntries = normalizeMixEntries(state.selectedInverterMix).map(([inverterBrandId, qty]) => ({ inverterBrandId, qty }));
    const batteryMixEntries = normalizeMixEntries(state.selectedBatteryMix).map(([batteryBrandId, qty]) => ({ batteryBrandId, qty }));

    // Check if updating existing quote
    let quoteIdToUse = state.activeQuoteId || generateQuoteId();
    let existingDbId: string | null = null;
    let existingStatus: 'Draft' | 'Sent' | 'Won' | 'Lost' = 'Draft';
    let existingCreatedAt = now;
    let dbVersion = 1;

    if (state.activeQuoteId) {
      const { data: existingQuote } = await supabase
        .from('quotes')
        .select('id, status, created_at, version')
        .eq('quote_number', state.activeQuoteId)
        .maybeSingle();
      if (existingQuote) {
        existingDbId = existingQuote.id;
        existingStatus = existingQuote.status === 'draft' ? 'Draft' : existingQuote.status === 'sent' ? 'Sent' : existingQuote.status === 'won' ? 'Won' : 'Lost';
        existingCreatedAt = existingQuote.created_at;
        dbVersion = existingQuote.version ?? 1;

        // Optimistic lock verification (CAS check)
        if (!forceOverwrite) {
          const localQuote = state.quotes.find((q) => q.quoteId === state.activeQuoteId);
          const localVersion = localQuote?.version ?? 1;
          if (localVersion !== dbVersion) {
            throw new Error('CONCURRENCY_CONFLICT');
          }
        }
      }
    }

    const quote: Quote = {
      quoteId: quoteIdToUse,
      date: now.split('T')[0],
      projectType: state.projectType,

      customer: info.customer,
      address: info.address,
      site: info.site,
      sales: info.sales,

      systemId: state.selectedSystemId,
      systemName: system.name,
      category: system.category,
      selectedState: state.selectedState,

      equipment: {
        panelBrandId:
          panelMixEntries.length === 1
            ? panelMixEntries[0].panelBrandId
            : state.selectedPanelId ?? undefined,
        panelMix: panelMixEntries.length > 0 ? panelMixEntries : undefined,
        inverterBrandId: inverterMixEntries.length === 1 ? inverterMixEntries[0].inverterBrandId : undefined,
        inverterMix: inverterMixEntries.length > 0 ? inverterMixEntries : undefined,
        batteryBrandId: batteryMixEntries.length === 1 ? batteryMixEntries[0].batteryBrandId : undefined,
        batteryMix: batteryMixEntries.length > 0 ? batteryMixEntries : undefined,
      },

      additionalCosts: [...state.additionalCosts],
      discountType: state.discountType,
      discountVal: state.discountVal,
      overrides: { ...state.overrides },
      customItems: [...state.customItems],
      disabledItemIndices: { ...state.disabledItemIndices },
      targetMarginPct: state.targetMarginPct ?? undefined,

      calculations: { ...state.calcResult },

      status: existingStatus,
      createdAt: existingCreatedAt,
      updatedAt: now,
    };

    // Add custom fields for state restoration
    (quote as any).structureId = state.selectedStructureId;
    (quote as any).structurePricingMode = state.structurePricingMode;
    (quote as any).solarMeterId = state.solarMeterId;
    (quote as any).solarMeterQty = state.solarMeterQty;
    (quote as any).netMeterId = state.netMeterId;
    (quote as any).netMeterQty = state.netMeterQty;
    (quote as any).lightningArresterId = state.lightningArresterId;
    (quote as any).lightningArresterQty = state.lightningArresterQty;

    const dbQuoteData: any = {
      org_id: orgId,
      quote_number: quote.quoteId,
      status: quote.status.toLowerCase(),
      project_type: quote.projectType,
      customer_name: quote.customer.name,
      customer_phone: quote.customer.phone || null,
      customer_whatsapp: quote.customer.whatsapp || null,
      customer_email: quote.customer.email || null,
      address_line1: quote.address.line1 || null,
      address_line2: quote.address.line2 || null,
      city: quote.address.city || null,
      state_name: quote.address.state,
      pincode: quote.address.pin || null,
      meter_number: quote.site.meterNo || null,
      sanctioned_load_kw: parseFloat(quote.site.sanctionedLoad) || null,
      monthly_bill_inr: quote.site.monthlyBill || null,
      roof_type: quote.site.roofType || null,
      roof_area_sqft: quote.site.roofArea || null,
      exec_name: quote.sales.execName,
      sale_type: quote.sales.saleType.toLowerCase(),
      project_title: quote.sales.projectTitle,
      notes: quote.sales.notes || null,
      system_id: quote.systemId,
      system_name: quote.systemName,
      system_category: system.category.replace('-', '_'),
      system_capacity_kw: system.capacityKW,
      panel_brand_model: quote.equipment.panelBrandId || null,
      panel_qty: panelMixEntries.reduce((sum, e) => sum + e.qty, 0) || null,
      inverter_brand_model: quote.equipment.inverterBrandId || null,
      inverter_qty: inverterMixEntries.reduce((sum, e) => sum + e.qty, 0) || null,
      battery_brand_model: quote.equipment.batteryBrandId || null,
      battery_qty: batteryMixEntries.reduce((sum, e) => sum + e.qty, 0) || null,
      discount_type: quote.discountType,
      discount_val: quote.discountVal,
      cost_before_gst: quote.calculations.costBeforeGST,
      total_input_gst: quote.calculations.totalInputGST,
      total_incl_gst: quote.calculations.totalIncGST,
      effective_margin_pct: quote.calculations.effectiveMarginPct,
      mrp_excl_gst: quote.calculations.mrpExclGST,
      gst_output_rate: quote.calculations.gstOutputRate,
      output_gst_amount: quote.calculations.mrpInclGST - quote.calculations.mrpExclGST,
      mrp_incl_gst: quote.calculations.mrpInclGST,
      discount_amount: quote.calculations.discountAmount,
      additional_costs_total: quote.calculations.additionalCostTotal,
      final_customer_price: quote.calculations.finalCustomerPrice,
      subsidy_amount: quote.calculations.subsidyAmount,
      beneficiary_contribution: quote.calculations.beneficiaryContribution,
      per_kw_excl_gst: quote.calculations.perKWexclGST,
      per_kw_incl_gst: quote.calculations.perKWinclGST,
      annual_generation_kwh: quote.calculations.annualGenerationKWh,
      annual_savings_inr: quote.calculations.annualSavingsINR,
      payback_years: quote.calculations.paybackYears === Infinity ? null : quote.calculations.paybackYears,
      lifetime_savings_inr: quote.calculations.lifetimeSavingsINR,
      co2_offset_kg_per_year: quote.calculations.annualGenerationKWh * 0.82,
      created_by: session.user.id,
      updated_at: now,

      structure_id: (quote as any).structureId || null,
      structure_pricing_mode: (quote as any).structurePricingMode || 'weight',
      solar_meter_id: (quote as any).solarMeterId || null,
      solar_meter_qty: (quote as any).solarMeterQty || 1,
      net_meter_id: (quote as any).netMeterId || null,
      net_meter_qty: (quote as any).netMeterQty || 1,
      la_id: (quote as any).lightningArresterId || null,
      la_qty: (quote as any).lightningArresterQty || 1,
      gst_output_override: state.gstOnOutputOverride,
      target_mrp_incl_gst: state.targetMRPInclGST,
      target_mrp_per_watt: state.targetMRPPerWatt,
    };

    if (existingDbId) {
      const versionToUse = forceOverwrite ? dbVersion : (state.quotes.find((q) => q.quoteId === state.activeQuoteId)?.version ?? 1);
      const { data: updatedRows, error: updateError } = await supabase
        .from('quotes')
        .update(dbQuoteData)
        .eq('id', existingDbId)
        .eq('version', versionToUse)
        .select();
      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('CONCURRENCY_CONFLICT');
      }
    } else {
      dbQuoteData.created_at = now;
      const { data: newQuote, error: insertError } = await supabase
        .from('quotes')
        .insert(dbQuoteData)
        .select('id')
        .single();
      if (insertError) throw insertError;
      existingDbId = newQuote.id;
    }

    // Delete old items & costs
    await Promise.all([
      supabase.from('quote_items').delete().eq('quote_id', existingDbId),
      supabase.from('quote_additional_costs').delete().eq('quote_id', existingDbId),
    ]);

    // Insert new items
    const dbItems = quote.calculations.lines.map((line: any) => ({
      quote_id: existingDbId,
      sort_order: line.index,
      section: (
        line.description === 'PANEL' ? 'solar_panels' :
        (line.description === 'INVERTER' || line.description === 'COMMUNICATION DEVICE' || line.description === 'BATTERY') ? 'power_electronics' :
        (line.description === 'SOLAR METER' || line.description === 'NET METER') ? 'metering' :
        (line.description.startsWith('STRUCTURE') || line.description === 'ACCESSORIES') ? 'mounting_structure' :
        ['ACDB', 'DCDB', 'ISOLATOR', 'METER BOX'].includes(line.description) ? 'electrical_protection' :
        ['EARTH ROD', 'GI STRIP', 'EARTH COMPOUND', 'CHAMBER BOX', 'EARTH BENCH'].includes(line.description) ? 'earthing' :
        ['DC CABLE', 'AC CABLE', 'ALUM CABLE 50 SQMM', 'ALUM CABLE 10 SQMM', 'COPPER', 'MC4(ADDITIONAL)'].includes(line.description) ? 'cabling' :
        ['WIRING PIPE', 'WIRING ACCESSORIES', 'L/A', 'LIGHTNING ARRESTER'].includes(line.description) ? 'wiring' :
        'services'
      ) as any,
      description: line.description,
      remarks: line.remarks || null,
      unit: line.unit || 'Nos',
      qty: line.effectiveQty,
      rate_per_unit: line.effectiveRate,
      gst_pct: line.effectiveGstPct,
      is_qty_overridden: state.overrides[line.index]?.qty !== undefined,
      is_rate_overridden: state.overrides[line.index]?.ratePerUnit !== undefined,
      is_gst_overridden: state.overrides[line.index]?.gstPct !== undefined,
      is_included: !line.isDisabled,
      is_mandatory: line.description === 'PANEL' || line.description === 'INVERTER',
      line_total: line.lineTotal,
      line_gst: line.lineGST,
      line_subtotal: line.lineSubTotal,
    }));

    if (dbItems.length > 0) {
      const { error: itemsError } = await supabase.from('quote_items').insert(dbItems);
      if (itemsError) throw itemsError;
    }

    // Insert new costs
    const dbCosts = quote.additionalCosts.map((cost: any, idx: number) => ({
      quote_id: existingDbId,
      description: cost.description,
      amount: cost.amount,
      sort_order: idx,
    }));

    if (dbCosts.length > 0) {
      const { error: costsError } = await supabase.from('quote_additional_costs').insert(dbCosts);
      if (costsError) throw costsError;
    }

    // Update local store quotes
    const localQuotes = state.quotes.filter((q) => q.quoteId !== quote.quoteId);
    quote.version = existingDbId ? (forceOverwrite ? dbVersion : (state.quotes.find((q) => q.quoteId === state.activeQuoteId)?.version ?? 1)) + 1 : 1;
    set({
      quotes: [...localQuotes, quote],
      activeQuoteId: quote.quoteId,
    });

    return quote;
  },

  loadQuote: (quoteId: string) => {
    const quote = get().quotes.find((q) => q.quoteId === quoteId);
    if (!quote) return;

    const quotePanelMix = Object.fromEntries(
      (quote.equipment.panelMix ?? []).map((entry) => [entry.panelBrandId, entry.qty]),
    );
    const fallbackSelectedPanelId = Object.keys(quotePanelMix)[0] ?? quote.equipment.panelBrandId ?? null;
    const quoteInverterMix = Object.fromEntries(
      (quote.equipment.inverterMix ?? (quote.equipment.inverterBrandId ? [{ inverterBrandId: quote.equipment.inverterBrandId, qty: 1 }] : []))
        .map((entry) => [entry.inverterBrandId, entry.qty]),
    );
    const quoteBatteryMix = Object.fromEntries(
      (quote.equipment.batteryMix ?? (quote.equipment.batteryBrandId ? [{ batteryBrandId: quote.equipment.batteryBrandId, qty: 1 }] : []))
        .map((entry) => [entry.batteryBrandId, entry.qty]),
    );

    set({
      selectedSystemId: quote.systemId,
      selectedState: quote.selectedState,
      projectType: quote.projectType,
      targetMarginPct: quote.targetMarginPct ?? null,
      overrides: { ...quote.overrides },
      customItems: [...(quote.customItems ?? [])],
      disabledItemIndices: { ...(quote.disabledItemIndices ?? {}) },
      additionalCosts: [...quote.additionalCosts],
      discountType: quote.discountType,
      discountVal: quote.discountVal,
      selectedPanelId: fallbackSelectedPanelId,
      panelMix: quotePanelMix,
      selectedInverterMix: quoteInverterMix,
      selectedBatteryMix: quoteBatteryMix,
      activeVariantId: null,
      activeQuoteId: quoteId,

      // restore selections
      selectedStructureId: (quote as any).structureId ?? null,
      structurePricingMode: (quote as any).structurePricingMode ?? 'weight',
      solarMeterId: (quote as any).solarMeterId ?? null,
      solarMeterQty: (quote as any).solarMeterQty ?? 1,
      netMeterId: (quote as any).netMeterId ?? null,
      netMeterQty: (quote as any).netMeterQty ?? 1,
      lightningArresterId: (quote as any).lightningArresterId ?? null,
      lightningArresterQty: (quote as any).lightningArresterQty ?? 1,

      gstOnOutputOverride: (quote as any).gstOnOutputOverride ?? null,
      targetMRPInclGST: (quote as any).targetMRPInclGST ?? null,
      targetMRPPerWatt: (quote as any).targetMRPPerWatt ?? null,
    });
    get().recalculate();
  },

  duplicateQuote: (quoteId: string) => {
    const quote = get().quotes.find((q) => q.quoteId === quoteId);
    if (!quote) return;
    get().loadQuote(quoteId);
    set({ activeQuoteId: null });
  },
});
