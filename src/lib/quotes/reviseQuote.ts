import { supabase } from '@/lib/supabase/client';
import { QuoteORM, QuoteItemORM, QuoteAdditionalCostORM, QuoteVariantORM } from '@/backend/orm/quote';

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function normalizeMarginPct(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num > 1 ? num / 100 : num;
}

function deriveMarkupPctFromSavedQuote(quote: Record<string, any>): number {
  const savedCost = Number(quote.cost_before_gst || 0);
  const savedMrpExcl = Number(quote.mrp_excl_gst || 0);
  const savedMargin = savedMrpExcl - savedCost;

  if (savedCost > 0 && Number.isFinite(savedMargin) && savedMargin >= 0) {
    return savedMargin / savedCost;
  }

  return normalizeMarginPct(quote.effective_margin_pct);
}

/**
 * Revise a quote, creating a new version with cloned items and auto-updated BOM
 * if a survey is provided.
 */
export async function reviseQuote(
  originalQuoteId: string, // this is the UUID
  revisionReason: string,
  surveyId?: string
): Promise<string> {
  // 1. Fetch original quote
  const originalQuote = await QuoteORM.getById(originalQuoteId);
  if (!originalQuote) {
    throw new Error(`Original quote ${originalQuoteId} not found`);
  }

  // Generate the next version across the full quote family, not just the
  // currently opened row. This keeps v2, v3, v4 stable even when revising v2.
  const rootQuoteId = originalQuote.parent_quote_id || originalQuote.id;
  const { data: siblingVersions } = await supabase
    .from('quotes')
    .select('version')
    .or(`id.eq.${rootQuoteId},parent_quote_id.eq.${rootQuoteId}`);
  const currentVersion = Math.max(
    originalQuote.version || 1,
    ...(siblingVersions || []).map((row: any) => Number(row.version || 1)),
  );
  const nextVersion = currentVersion + 1;
  
  // Extract base quote number (remove existing -v suffix if any)
  const baseQuoteNumber = originalQuote.quote_number.replace(/-v\d+$/, '');
  const newQuoteNumber = `${baseQuoteNumber}-v${nextVersion}`;

  // 2. Clone quote record
  const {
    id: _id,
    quote_number: _qn,
    status: _status,
    created_at: _ca,
    updated_at: _ua,
    version: _ver,
    parent_quote_id: _pqi,
    version_reason: _vr,
    survey_id: _si,
    quote_items: originalItems,
    quote_additional_costs: originalCosts,
    quote_variants: originalVariants,
    ...quoteDataToCopy
  } = originalQuote;

  let surveyData: any = null;
  if (surveyId) {
    const { data, error } = await supabase
      .from('crm_site_surveys')
      .select('*')
      .eq('id', surveyId)
      .single();
    if (!error && data) {
      surveyData = data;
      
      // Map structure type from survey
      if (surveyData.roof_type) {
        quoteDataToCopy.structure_type = surveyData.roof_type;
      }
      if (surveyData.sanctioned_load_kw) {
        quoteDataToCopy.sanctioned_load_kw = Number(surveyData.sanctioned_load_kw);
      }
    }
  }

  // Create new quote
  const { data: newQuote, error: createError } = await supabase
    .from('quotes')
    .insert({
      ...quoteDataToCopy,
      quote_number: newQuoteNumber,
      status: 'draft',
      version: nextVersion,
      parent_quote_id: rootQuoteId,
      version_reason: revisionReason,
      survey_id: surveyId || null,
      updated_at: new Date().toISOString(),
    })
    .select('id, quote_number')
    .single();

  if (createError) throw createError;

  // 3. Clone and update items
  let newItems = originalItems.map((item: any) => {
    const { id: _iId, quote_id: _qId, created_at: _iCa, updated_at: _iUa, ...itemData } = item;
    
    // Auto-update logic based on survey
    if (surveyData) {
      const desc = (itemData.description || '').toUpperCase();
      
      if (desc.includes('DC CABLE') && surveyData.distance_panel_to_inverter_m) {
        const stringCount = Math.ceil((originalQuote.panel_qty || 10) / 10);
        itemData.qty = Math.ceil(surveyData.distance_panel_to_inverter_m * 2 * stringCount * 1.15);
        itemData.is_qty_overridden = true;
      } 
      else if (desc.includes('AC CABLE') && surveyData.distance_inverter_to_meter_m) {
        const phaseMultiplier = surveyData.meter_phase === 'three' ? 3 : 2;
        itemData.qty = Math.ceil(surveyData.distance_inverter_to_meter_m * phaseMultiplier);
        itemData.is_qty_overridden = true;
      }
      else if (desc.includes('CONDUIT') || desc.includes('PIPE')) {
        const dcM = surveyData.distance_panel_to_inverter_m || 0;
        const acM = surveyData.distance_inverter_to_meter_m || 0;
        if (dcM || acM) {
          const stringCount = Math.ceil((originalQuote.panel_qty || 10) / 10);
          const phaseMultiplier = surveyData.meter_phase === 'three' ? 3 : 2;
          const dcCableM = dcM * 2 * stringCount * 1.15;
          const acCableM = acM * phaseMultiplier;
          itemData.qty = Math.ceil((dcCableM + acCableM) * 1.1);
          itemData.is_qty_overridden = true;
        }
      }
      else if (desc.includes('LIGHTNING ARRESTER') || desc.includes(' LA ')) {
        if (surveyData.roof_area_sqft) {
          itemData.qty = Math.ceil(surveyData.roof_area_sqft / 1500);
          itemData.is_qty_overridden = true;
        }
      }
      else if (desc.includes('STRUCTURE') && surveyData.roof_type) {
        itemData.description = `${surveyData.roof_type} Mounting Structure`;
      }
    }
    
    // Keep quote_items field semantics aligned with the DB trigger:
    // line_total = excl GST, line_gst = tax, line_subtotal = incl GST.
    const isIncluded = itemData.is_included !== false;
    const qty = Number(itemData.qty || 0);
    const rate = Number(itemData.rate_per_unit || 0);
    const gstPct = Number(itemData.gst_pct || 0);
    itemData.line_total = isIncluded ? roundMoney(qty * rate) : 0;
    itemData.line_gst = isIncluded ? roundMoney(itemData.line_total * gstPct) : 0;
    itemData.line_subtotal = roundMoney(itemData.line_total + itemData.line_gst);

    return { ...itemData, quote_id: newQuote.id };
  });

  if (newItems.length > 0) {
    await QuoteItemORM.createMany(newItems);
  }

  // Clone costs
  const newCosts = originalCosts.map((cost: any) => {
    const { id: _cId, quote_id: _qId, created_at: _cCa, ...costData } = cost;
    return { ...costData, quote_id: newQuote.id };
  });

  if (newCosts.length > 0) {
    const { error: costsError } = await supabase.from('quote_additional_costs').insert(newCosts);
    if (costsError) throw costsError;
  }

  // Clone variants
  const newVariants = originalVariants.map((v: any) => {
    const { id: _vId, quote_id: _qId, created_at: _vCa, updated_at: _vUa, ...vData } = v;
    return { ...vData, quote_id: newQuote.id };
  });

  if (newVariants.length > 0) {
    const { error: varsError } = await supabase.from('quote_variants').insert(newVariants);
    if (varsError) throw varsError;
  }

  // Recalculate Quote Totals based on updated items
  const newCostBeforeGst = roundMoney(newItems.reduce((sum: number, item: any) => sum + (item.is_included !== false ? Number(item.line_total || 0) : 0), 0));
  const newTotalInputGst = roundMoney(newItems.reduce((sum: number, item: any) => sum + (item.is_included !== false ? Number(item.line_gst || 0) : 0), 0));
  const newTotalInclGst = roundMoney(newCostBeforeGst + newTotalInputGst);
  
  const additionalTotal = roundMoney(newCosts.reduce((sum: number, cost: any) => sum + Number(cost.amount || 0), 0));
  const effectiveMarginPct = deriveMarkupPctFromSavedQuote(quoteDataToCopy);
  const gstOutputRate = Math.max(0, Number(quoteDataToCopy.gst_output_rate || 0));
  const marginMode = quoteDataToCopy.margin_mode === 'flat' ? 'flat' : 'percent';
  const targetMarginAmount = Number(quoteDataToCopy.target_margin_amount || 0);
  const marginAmount = marginMode === 'flat'
    ? Math.max(0, targetMarginAmount)
    : roundMoney(newCostBeforeGst * effectiveMarginPct);
  const mrpExclGst = roundMoney(newCostBeforeGst + marginAmount);
  const outputGstAmount = roundMoney(mrpExclGst * gstOutputRate);
  const mrpInclGst = roundMoney(mrpExclGst + outputGstAmount);

  const discountType = quoteDataToCopy.discount_type || 'none';
  const rawDiscountVal = Number(quoteDataToCopy.discount_val || 0);
  const discountVal = roundMoney(
    discountType === 'percent'
      ? mrpInclGst * (Math.min(Math.max(rawDiscountVal, 0), 100) / 100)
      : discountType === 'flat'
        ? rawDiscountVal
        : 0
  );

  const finalCustomerPrice = roundMoney(Math.max(0, mrpInclGst + additionalTotal - discountVal));
  const systemCapacity = Number(quoteDataToCopy.system_capacity_kw || 1) || 1;
  const perKwInclGst = roundMoney(finalCustomerPrice / systemCapacity);
  const perKwExclGst = roundMoney((mrpExclGst + additionalTotal - discountVal) / systemCapacity);

  // Update new quote with recalculated totals
  await supabase.from('quotes').update({
    cost_before_gst: newCostBeforeGst,
    total_input_gst: newTotalInputGst,
    total_incl_gst: newTotalInclGst,
    mrp_excl_gst: mrpExclGst,
    output_gst_amount: outputGstAmount,
    mrp_incl_gst: mrpInclGst,
    discount_amount: discountVal,
    final_customer_price: finalCustomerPrice,
    per_kw_incl_gst: perKwInclGst,
    per_kw_excl_gst: perKwExclGst,
    beneficiary_contribution: roundMoney(Math.max(0, finalCustomerPrice - (quoteDataToCopy.subsidy_amount || 0))),
  }).eq('id', newQuote.id);

  return newQuote.quote_number;
}
