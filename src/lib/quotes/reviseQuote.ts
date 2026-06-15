import { supabase } from '@/lib/supabase/client';
import { SurveyORM } from '@/backend/orm/survey';
import { QuoteORM, QuoteItemORM, QuoteAdditionalCostORM, QuoteVariantORM } from '@/backend/orm/quote';

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

  // Generate new quote_number based on original (e.g. QT-20240101-ABCD-v2)
  const currentVersion = originalQuote.version || 1;
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
      parent_quote_id: originalQuoteId,
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
    
    // Re-calc totals for item
    itemData.line_subtotal = itemData.qty * itemData.rate_per_unit;
    itemData.line_gst = itemData.line_subtotal * itemData.gst_pct;
    itemData.line_total = itemData.line_subtotal + itemData.line_gst;

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
  const newCostBeforeGst = newItems.reduce((sum: number, item: any) => sum + (item.is_included ? item.line_subtotal : 0), 0);
  const newTotalInputGst = newItems.reduce((sum: number, item: any) => sum + (item.is_included ? item.line_gst : 0), 0);
  const newTotalInclGst = newCostBeforeGst + newTotalInputGst;
  
  const additionalTotal = newCosts.reduce((sum: number, cost: any) => sum + Number(cost.amount), 0);
  const discountVal = quoteDataToCopy.discount_type === 'percentage' 
    ? (newCostBeforeGst * (quoteDataToCopy.discount_val / 100))
    : quoteDataToCopy.discount_val;

  const mrpExclGst = newCostBeforeGst / (1 - (quoteDataToCopy.effective_margin_pct || 0));
  const marginAmount = mrpExclGst - newCostBeforeGst;
  const outputGstAmount = mrpExclGst * quoteDataToCopy.gst_output_rate;
  const mrpInclGst = mrpExclGst + outputGstAmount;

  const finalCustomerPrice = mrpInclGst + additionalTotal - discountVal;
  const perKwInclGst = finalCustomerPrice / (quoteDataToCopy.system_capacity_kw || 1);
  const perKwExclGst = (mrpExclGst + additionalTotal - discountVal) / (quoteDataToCopy.system_capacity_kw || 1);

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
    beneficiary_contribution: Math.max(0, finalCustomerPrice - (quoteDataToCopy.subsidy_amount || 0)),
  }).eq('id', newQuote.id);

  return newQuote.quote_number;
}
