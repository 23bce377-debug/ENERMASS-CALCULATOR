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
import { assertCalcResultIntegrity } from '@/lib/math/integrity';

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
      validationAcknowledged?: string[];
      leadId?: string | null;
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
      sales_exec_id?: string | null;
      bank_account_holder?: string;
      bank_name?: string;
      bank_account_no?: string;
      bank_ifsc?: string;
      bank_upi_id?: string;
      terms_json?: string[];
      why_solar_json?: any;
    },
    forceOverwrite?: boolean
  ): Promise<Quote> => {
    const state = get();

    if (!state.selectedSystemId || !state.calcResult) {
      throw new Error('Cannot save quote: no system selected or calculation missing.');
    }
    assertCalcResultIntegrity(state.calcResult, {
      projectType: state.projectType,
      context: 'quote save',
    });

    const { supabase } = await import('../../supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Unauthorized');

    const { ProfileORM } = await import('../../../backend/orm/profile');
    const profile = await ProfileORM.getById(session.user.id);
    const orgId = profile.org_id;
    try {
      const { error: snapshotError } = await (supabase as any).rpc('snapshot_catalog_rates', {
        p_org_id: orgId,
      });
      if (snapshotError) {
        console.warn('[quoteStore] Catalog rate snapshot skipped:', snapshotError.message || snapshotError);
      }
    } catch (err) {
      console.warn('[quoteStore] Catalog rate snapshot unavailable:', err);
    }

    // Resolve system metadata
    const system = getAllSystemsFromSettings(state.dbLoaded, state.dbSystems).find((s) => s.id === state.selectedSystemId);
    if (!system) {
      throw new Error(`System not found: "${state.selectedSystemId}"`);
    }

    const now = new Date().toISOString();
    const syncedAddress = {
      ...info.address,
      state: state.selectedState || info.address.state,
    };
    const panelMixEntries = Object.entries(state.panelMix)
      .filter(([, qty]) => Number.isFinite(qty) && qty > 0)
      .map(([panelBrandId, qty]) => ({ panelBrandId, qty }));

    const inverterMixEntries = normalizeMixEntries(state.selectedInverterMix).map(([inverterBrandId, qty]) => ({ inverterBrandId, qty }));
    const batteryMixEntries = normalizeMixEntries(state.selectedBatteryMix).map(([batteryBrandId, qty]) => ({ batteryBrandId, qty }));
    const panelQty = panelMixEntries.reduce((sum, e) => sum + e.qty, 0);
    const inverterQty = inverterMixEntries.reduce((sum, e) => sum + e.qty, 0);
    const batteryQty = batteryMixEntries.reduce((sum, e) => sum + e.qty, 0);
    const selectedPanelBrandId =
      panelMixEntries.length === 1
        ? panelMixEntries[0].panelBrandId
        : state.selectedPanelId ?? undefined;

    const getReadableEquipmentName = (
      collection: Array<Record<string, any>>,
      id: string | undefined,
      metaKeys: string[] = [],
    ) => {
      if (!id) return undefined;
      const item = collection.find((entry) => entry.id === id);
      if (!item) return id;

      const brandModel = [item.brand, item.model].filter(Boolean).join(' ').trim();
      const baseName = brandModel || item.name || item.label || id;
      const meta = metaKeys
        .map((key) => {
          const value = item[key];
          if (value === undefined || value === null || value === '') return null;
          if (key === 'wattage') return `${value} Wp`;
          if (key === 'capacityKW') return `${value} kW`;
          if (key === 'capacityKWh') return `${value} kWh`;
          return value;
        })
        .filter((value) => value !== undefined && value !== null && value !== '')
        .join(', ');

      return meta ? `${baseName} (${meta})` : baseName;
    };

    const formatMixLabel = <T extends Record<string, any>>(
      entries: T[],
      idKey: keyof T,
      collection: Array<Record<string, any>>,
      metaKeys: string[] = [],
      unit = 'Nos',
    ) => {
      if (entries.length === 0) return undefined;
      return entries
        .map((entry) => {
          const label = getReadableEquipmentName(collection, String(entry[idKey]), metaKeys);
          return entries.length > 1 ? `${label} - ${entry.qty} ${unit}` : label;
        })
        .filter(Boolean)
        .join(', ');
    };

    const panelBrandModel =
      formatMixLabel(panelMixEntries, 'panelBrandId', state.dbPanels, ['wattage']) ??
      getReadableEquipmentName(state.dbPanels, selectedPanelBrandId, ['wattage']);
    const inverterBrandModel = formatMixLabel(inverterMixEntries, 'inverterBrandId', state.dbInverters, ['capacityKW']);
    const batteryBrandModel = formatMixLabel(batteryMixEntries, 'batteryBrandId', state.dbBatteries, ['capacityKWh']);

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
      address: syncedAddress,
      site: info.site,
      sales: info.sales,

      systemId: state.selectedSystemId,
      systemName: system.name,
      category: system.category,
      selectedState: state.selectedState,
      panelQty: panelQty || undefined,
      panelBrandModel,

      equipment: {
        panelBrandId: selectedPanelBrandId,
        panelMix: panelMixEntries.length > 0 ? panelMixEntries : undefined,
        inverterBrandId: inverterMixEntries.length === 1 ? inverterMixEntries[0].inverterBrandId : undefined,
        inverterMix: inverterMixEntries.length > 0 ? inverterMixEntries : undefined,
        batteryBrandId: batteryMixEntries.length === 1 ? batteryMixEntries[0].batteryBrandId : undefined,
        batteryMix: batteryMixEntries.length > 0 ? batteryMixEntries : undefined,
        roundOffToThousand: state.roundOffToThousand,
        unroundedFinalCustomerPrice: state.calcResult.unroundedFinalCustomerPrice,
        roundOffAdjustment: state.calcResult.roundOffAdjustment,
        marginMode: state.marginMode,
        targetMarginAmount: state.targetMarginAmount ?? undefined,
      },

      additionalCosts: [...state.additionalCosts],
      discountType: state.discountType,
      discountVal: state.discountVal,
      overrides: { ...state.overrides },
      customItems: [...state.customItems],
      disabledItemIndices: { ...state.disabledItemIndices },
      marginMode: state.marginMode,
      targetMarginPct: state.targetMarginPct ?? undefined,
      targetMarginAmount: state.targetMarginAmount ?? undefined,
      roundOffToThousand: state.roundOffToThousand,

      calculations: { ...state.calcResult },

      status: existingStatus,
      createdAt: existingCreatedAt,
      updatedAt: now,

      company_cin: info.company_cin,
      company_gstin: info.company_gstin,
      company_pan: info.company_pan,
      company_phone: info.company_phone,
      company_email: info.company_email,
      company_website: info.company_website,
      company_address: info.company_address,
      ceo_name: info.ceo_name,
      ceo_designation: info.ceo_designation,
      ceo_signature_url: info.ceo_signature_url,
      sales_exec_role: info.sales_exec_role,
      sales_exec_phone: info.sales_exec_phone,
      sales_exec_email: info.sales_exec_email,
      sales_exec_id: info.sales_exec_id || undefined,
      bank_account_holder: info.bank_account_holder,
      bank_name: info.bank_name,
      bank_account_no: info.bank_account_no,
      bank_ifsc: info.bank_ifsc,
      bank_upi_id: info.bank_upi_id,
      terms_json: info.terms_json,
      why_solar_json: info.why_solar_json,
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

      company_cin: quote.company_cin || null,
      company_gstin: quote.company_gstin || null,
      company_pan: quote.company_pan || null,
      company_phone: quote.company_phone || null,
      company_email: quote.company_email || null,
      company_website: quote.company_website || null,
      company_address: quote.company_address || null,
      ceo_name: quote.ceo_name || null,
      ceo_designation: quote.ceo_designation || null,
      ceo_signature_url: quote.ceo_signature_url || null,
      sales_exec_role: quote.sales_exec_role || null,
      sales_exec_phone: quote.sales_exec_phone || null,
      sales_exec_email: quote.sales_exec_email || null,
      exec_id: quote.sales_exec_id || null,
      bank_account_holder: quote.bank_account_holder || null,
      bank_name: quote.bank_name || null,
      bank_account_no: quote.bank_account_no || null,
      bank_ifsc: quote.bank_ifsc || null,
      bank_upi_id: quote.bank_upi_id || null,
      terms_json: quote.terms_json || null,
      why_solar_json: quote.why_solar_json || null,
      customer_name: quote.customer.name,
      customer_phone: quote.customer.phone || null,
      customer_whatsapp: quote.customer.whatsapp || null,
      customer_email: quote.customer.email || null,
      address_line1: quote.address.line1 || null,
      address_line2: quote.address.line2 || null,
      city: quote.address.city || null,
      state_name: quote.selectedState,
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
      equipment_json: quote.equipment,
      panel_brand_model: panelBrandModel || null,
      panel_qty: panelQty || null,
      inverter_brand_model: inverterBrandModel || null,
      inverter_qty: inverterQty || null,
      battery_brand_model: batteryBrandModel || null,
      battery_qty: batteryQty || null,
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
      subsidy_scheme_id: state.selectedSubsidySchemeId || null,
      subsidy_amount: quote.calculations.subsidyAmount,
      subsidy_breakdown: quote.calculations.subsidyResult?.breakdown || null,
      subsidy_eligible: Boolean(quote.calculations.subsidyResult?.isEligible),
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
      lead_id: info.leadId || null,

      structure_id: (quote as any).structureId && (quote as any).structureId !== 'custom' ? (quote as any).structureId : null,
      structure_pricing_mode: (quote as any).structurePricingMode || 'weight',
      solar_meter_id: (quote as any).solarMeterId && (quote as any).solarMeterId !== 'custom' ? (quote as any).solarMeterId : null,
      solar_meter_qty: (quote as any).solarMeterQty || 1,
      net_meter_id: (quote as any).netMeterId && (quote as any).netMeterId !== 'custom' ? (quote as any).netMeterId : null,
      net_meter_qty: (quote as any).netMeterQty || 1,
      la_id: (quote as any).lightningArresterId && (quote as any).lightningArresterId !== 'custom' ? (quote as any).lightningArresterId : null,
      la_qty: (quote as any).lightningArresterQty || 1,
      gst_output_override: state.gstOnOutputOverride,
      target_mrp_incl_gst: state.targetMRPInclGST,
      target_mrp_per_watt: state.targetMRPPerWatt,
      margin_mode: state.marginMode,
      target_margin_amount: state.targetMarginAmount,
      validation_acknowledged: info.validationAcknowledged ?? [],
    };
    const stripMarginColumns = (row: any) => {
      const { margin_mode, target_margin_amount, ...rest } = row;
      return rest;
    };
    const isMarginSchemaCacheMiss = (error: any) => {
      const message = error?.message || JSON.stringify(error);
      return message.includes('margin_mode') || message.includes('target_margin_amount');
    };

    if (existingDbId) {
      const versionToUse = forceOverwrite ? dbVersion : (state.quotes.find((q) => q.quoteId === state.activeQuoteId)?.version ?? 1);
      const { data: updatedRows, error: updateError } = await supabase
        .from('quotes')
        .update(dbQuoteData)
        .eq('id', existingDbId)
        .eq('version', versionToUse)
        .select();
      let finalUpdatedRows = updatedRows;
      if (updateError && isMarginSchemaCacheMiss(updateError)) {
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from('quotes')
          .update(stripMarginColumns(dbQuoteData))
          .eq('id', existingDbId)
          .eq('version', versionToUse)
          .select();
        if (fallbackError) throw new Error(fallbackError.message || JSON.stringify(fallbackError));
        finalUpdatedRows = fallbackRows;
      } else if (updateError) {
        throw new Error(updateError.message || JSON.stringify(updateError));
      }
      if (!finalUpdatedRows || finalUpdatedRows.length === 0) {
        throw new Error('CONCURRENCY_CONFLICT');
      }
    } else {
      dbQuoteData.created_at = now;
      const { data: newQuote, error: insertError } = await supabase
        .from('quotes')
        .insert(dbQuoteData)
        .select('id')
        .single();
      if (insertError && isMarginSchemaCacheMiss(insertError)) {
        const { data: fallbackQuote, error: fallbackInsertError } = await supabase
          .from('quotes')
          .insert(stripMarginColumns(dbQuoteData))
          .select('id')
          .single();
        if (fallbackInsertError) throw new Error(fallbackInsertError.message || JSON.stringify(fallbackInsertError));
        existingDbId = fallbackQuote.id;
      } else {
        if (insertError) throw new Error(insertError.message || JSON.stringify(insertError));
        existingDbId = newQuote.id;
      }
    }

    // Delete old items & costs
    await Promise.all([
      supabase.from('quote_items').delete().eq('quote_id', existingDbId),
      supabase.from('quote_additional_costs').delete().eq('quote_id', existingDbId),
    ]);

    // Insert customer-quoted items. Base/procurement rates are retained in original_* fields.
    const baseLineByIndex = new Map((quote.calculations.lines ?? []).map((line: any) => [line.index, line]));
    const lockedLines = quote.calculations.quotedLines?.length
      ? quote.calculations.quotedLines
      : quote.calculations.lines;
    const dbItems = lockedLines.map((line: any) => {
      const originalLine: any = baseLineByIndex.get(line.index) ?? line;
      return {
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
      original_qty: originalLine.effectiveQty,
      original_rate: originalLine.effectiveRate,
      original_gst: originalLine.effectiveGstPct,
      is_qty_overridden: state.overrides[line.index]?.qty !== undefined,
      is_rate_overridden: state.overrides[line.index]?.ratePerUnit !== undefined,
      is_gst_overridden: state.overrides[line.index]?.gstPct !== undefined,
      is_included: !line.isDisabled,
      is_mandatory: false,
      line_total: line.lineTotal,
      line_gst: line.lineGST,
      line_subtotal: line.lineSubTotal,
      source_table: line.sourceTable || null,
      source_item_id: line.sourceItemId || null,
      source_label: line.sourceLabel || null,
      quoted_rate_date: quote.date,
    };
    });

    if (dbItems.length > 0) {
      const { error: itemsError } = await supabase.from('quote_items').insert(dbItems);
      if (itemsError) {
        const message = itemsError.message || JSON.stringify(itemsError);
        if (
          message.includes('source_table') ||
          message.includes('source_item_id') ||
          message.includes('source_label') ||
          message.includes('quoted_rate_date') ||
          message.includes('original_qty') ||
          message.includes('original_rate') ||
          message.includes('original_gst')
        ) {
          const legacyItems = dbItems.map((item: any) => {
            const {
              source_table,
              source_item_id,
              source_label,
              quoted_rate_date,
              original_qty,
              original_rate,
              original_gst,
              ...legacyItem
            } = item;
            return legacyItem;
          });
          const { error: legacyItemsError } = await supabase.from('quote_items').insert(legacyItems);
          if (legacyItemsError) throw new Error(legacyItemsError.message || JSON.stringify(legacyItemsError));
        } else {
          throw new Error(message);
        }
      }
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
      if (costsError) throw new Error(costsError.message || JSON.stringify(costsError));
    }

    // Update local store quotes
    const localQuotes = state.quotes.filter((q) => q.quoteId !== quote.quoteId);
    quote.version = existingDbId ? (forceOverwrite ? dbVersion : (state.quotes.find((q) => q.quoteId === state.activeQuoteId)?.version ?? 1)) + 1 : 1;
    set({
      quotes: [...localQuotes, quote],
      activeQuoteId: quote.quoteId,
    });

    // Upload JSON representation to Supabase Storage Bucket for remote storage
    try {
      const fileContent = JSON.stringify(quote, null, 2);
      const filePath = `${orgId}/${quote.quoteId}.json`;
      
      const { error: uploadError } = await supabase.storage
        .from('quotes')
        .upload(filePath, new Blob([fileContent], { type: 'application/json' }), {
          contentType: 'application/json',
          upsert: true
        });

      if (uploadError) {
        console.error('[quoteStore] Failed to upload quote JSON to storage bucket:', uploadError.message || uploadError);
      } else {
        console.log(`[quoteStore] Successfully uploaded quote JSON to storage bucket: ${filePath}`);
      }
    } catch (err) {
      console.error('[quoteStore] Error uploading quote to storage bucket:', err);
    }

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
    const lockedLineOverrides = Object.fromEntries(
      (quote.calculations?.lines ?? []).map((line: any) => [
        line.index,
        {
          qty: Number(line.effectiveQty),
          ratePerUnit: Number(line.effectiveRate),
          gstPct: Number(line.effectiveGstPct),
        },
      ]),
    );

    set({
      selectedSystemId: quote.systemId,
      selectedState: quote.selectedState,
      projectType: quote.projectType,
      targetMarginPct: quote.targetMarginPct ?? null,
      overrides: { ...lockedLineOverrides, ...quote.overrides },
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
      marginMode: (quote as any).marginMode ?? quote.equipment?.marginMode ?? 'percent',
      targetMarginAmount: (quote as any).targetMarginAmount ?? quote.equipment?.targetMarginAmount ?? null,
      roundOffToThousand: quote.roundOffToThousand ?? quote.equipment?.roundOffToThousand ?? false,
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
