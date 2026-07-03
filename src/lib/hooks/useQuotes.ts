import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase/client'
import type { Quote } from '../types/quote'
import { useCalculatorStore } from '../store/calculatorStore'
import { reviseQuote } from '../quotes/reviseQuote'
import { roundMoney } from '@/lib/math/integrity'
import { normalizeGstRate } from '@/lib/utils/gst'

function toQuoteStatus(status: string | null | undefined): Quote['status'] {
  switch (status) {
    case 'sent':
      return 'Sent'
    case 'won':
      return 'Won'
    case 'lost':
      return 'Lost'
    case 'draft':
    default:
      return 'Draft'
  }
}

function normalizeMarginPct(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num > 1 ? num / 100 : num;
}

function deriveTargetMarginPct(q: any): number {
  const costBeforeGST = Number(q.cost_before_gst || 0);
  const mrpExclGST = Number(q.mrp_excl_gst || 0);
  const marginAmount = mrpExclGST - costBeforeGST;

  if (costBeforeGST > 0 && Number.isFinite(marginAmount) && marginAmount >= 0) {
    return marginAmount / costBeforeGST;
  }

  return normalizeMarginPct(q.effective_margin_pct);
}

// Map a DB quote row to the frontend Quote type
function mapDbQuoteToQuote(q: any): Quote {
  const looksLikeId = (value: unknown) =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)

  const equipment = q.equipment_json && typeof q.equipment_json === 'object'
    ? q.equipment_json
    : {
        panelBrandId: looksLikeId(q.panel_brand_model) ? q.panel_brand_model : undefined,
        inverterBrandId: looksLikeId(q.inverter_brand_model) ? q.inverter_brand_model : undefined,
        batteryBrandId: looksLikeId(q.battery_brand_model) ? q.battery_brand_model : undefined,
      }

  const overrides: any = {}
  ;(q.quote_items || []).forEach((item: any) => {
    overrides[item.sort_order] = {
      qty: Number(item.qty),
      ratePerUnit: Number(item.rate_per_unit),
      gstPct: normalizeGstRate(item.gst_pct, 0),
    }
  })

  const disabledItemIndices: Record<number, boolean> = {}
  ;(q.quote_items || []).forEach((item: any) => {
    if (!item.is_included) {
      disabledItemIndices[item.sort_order] = true
    }
  })

  const calculations: any = {
    lines: (q.quote_items || []).map((item: any) => ({
      index: item.sort_order,
      description: item.description,
      remarks: item.remarks || '',
      unit: item.unit || '',
      effectiveQty: Number(item.qty),
      effectiveRate: Number(item.rate_per_unit),
      effectiveGstPct: normalizeGstRate(item.gst_pct, 0),
      lineTotal: roundMoney(item.line_total),
      lineGST: roundMoney(item.line_gst),
      lineSubTotal: roundMoney(item.line_subtotal),
      isOverridden: item.is_qty_overridden || item.is_rate_overridden || !!item.is_gst_overridden,
      isDisabled: !item.is_included,
      sourceTable: item.source_table || undefined,
      sourceItemId: item.source_item_id || undefined,
      sourceLabel: item.source_label || undefined,
    })),
    quotedLines: (q.quote_items || []).map((item: any) => ({
      index: item.sort_order,
      description: item.description,
      remarks: item.remarks || '',
      unit: item.unit || '',
      effectiveQty: Number(item.qty),
      effectiveRate: Number(item.rate_per_unit),
      effectiveGstPct: normalizeGstRate(item.gst_pct, 0),
      lineTotal: roundMoney(item.line_total),
      lineGST: roundMoney(item.line_gst),
      lineSubTotal: roundMoney(item.line_subtotal),
      isOverridden: true,
      isDisabled: !item.is_included,
      sourceTable: item.source_table || undefined,
      sourceItemId: item.source_item_id || undefined,
      sourceLabel: item.source_label || undefined,
    })),
    costBeforeGST: roundMoney(q.cost_before_gst),
    totalInputGST: roundMoney(q.total_input_gst),
    totalIncGST: roundMoney(q.total_incl_gst),
    effectiveMarginPct: Number(q.effective_margin_pct),
    mrpExclGST: roundMoney(q.mrp_excl_gst),
    marginAmount: roundMoney(Number(q.mrp_excl_gst) - Number(q.cost_before_gst)),
    gstOutputRate: normalizeGstRate(q.gst_output_rate, 0),
    mrpInclGST: roundMoney(q.mrp_incl_gst),
    discountAmount: roundMoney(q.discount_amount),
    unroundedFinalCustomerPrice: roundMoney(q.equipment_json?.unroundedFinalCustomerPrice ?? q.final_customer_price),
    roundOffAdjustment: roundMoney(q.equipment_json?.roundOffAdjustment ?? 0),
    roundOffToThousand: Boolean(q.equipment_json?.roundOffToThousand),
    finalCustomerPrice: roundMoney(q.final_customer_price),
    subsidyAmount: roundMoney(q.subsidy_amount),
    beneficiaryContribution: roundMoney(q.beneficiary_contribution),
    additionalCostTotal: roundMoney(q.additional_costs_total),
    perKWexclGST: roundMoney(q.per_kw_excl_gst || 0),
    perKWinclGST: roundMoney(q.per_kw_incl_gst || 0),
    dailyGenerationKWh: Number(q.annual_generation_kwh || 0) / 365,
    monthlyGenerationKWh: Number(q.annual_generation_kwh || 0) / 12,
    annualGenerationKWh: Number(q.annual_generation_kwh || 0),
    monthlySavingsINR: Number(q.annual_savings_inr || 0) / 12,
    annualSavingsINR: Number(q.annual_savings_inr || 0),
    paybackYears: Number(q.payback_years || 0),
    lcoe: 0,
  }

  return {
    dbId: q.id,
    quoteId: q.quote_number,
    date: q.date || q.created_at.split('T')[0],
    projectType: q.project_type,
    customer: {
      name: q.customer_name,
      phone: q.customer_phone || '',
      whatsapp: q.customer_whatsapp || '',
      email: q.customer_email || '',
    },
    address: {
      line1: q.address_line1 || '',
      line2: q.address_line2 || '',
      city: q.city || '',
      state: q.state_name || 'Gujarat',
      pin: q.pincode || '',
    },
    site: {
      meterNo: q.meter_number || '',
      sanctionedLoad: String(q.sanctioned_load_kw || ''),
      monthlyBill: Number(q.monthly_bill_inr || 0),
      roofType: q.roof_type || 'RCC',
      roofArea: Number(q.roof_area_sqft || 0),
    },
    sales: {
      projectTitle: q.project_title || '',
      execName: q.exec_name || '',
      notes: q.notes || '',
      saleType: (q.sale_type === 'new' ? 'New' : q.sale_type === 'upgrade' ? 'Upgrade' : 'Referral') as any,
    },
    systemId: q.system_id || '',
    systemName: q.system_name || (q.system_capacity_kw ? `${Number(q.system_capacity_kw)} kWp System` : 'Custom System'),
    category: (q.system_category || '').replace('_', '-'),
    systemCapacityKW: q.system_capacity_kw ? Number(q.system_capacity_kw) : undefined,
    panelQty: q.panel_qty ? Number(q.panel_qty) : undefined,
    panelBrandModel: q.panel_brand_model || undefined,
    selectedState: q.state_name || 'Gujarat',
    equipment,
    marginMode: q.margin_mode || equipment?.marginMode || 'percent',
    roundOffToThousand: Boolean(equipment?.roundOffToThousand),
    additionalCosts: (q.quote_additional_costs || []).map((c: any) => ({
      id: c.id,
      description: c.description,
      amount: Number(c.amount),
    })),
    discountType: q.discount_type,
    discountVal: Number(q.discount_val),
    overrides,
    disabledItemIndices,
    targetMarginPct: deriveTargetMarginPct(q),
    targetMarginAmount: q.target_margin_amount !== null && q.target_margin_amount !== undefined
      ? Number(q.target_margin_amount)
      : equipment?.targetMarginAmount,
    calculations,
    status: toQuoteStatus(q.status),
    statusHistory: q.quote_status_history?.length
      ? q.quote_status_history.map((h: any) => ({
          status: toQuoteStatus(h.new_status),
          changedAt: h.changed_at,
        })).sort((a: any, b: any) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
      : [{ status: toQuoteStatus(q.status), changedAt: q.updated_at || q.created_at }],
    createdAt: q.created_at,
    updatedAt: q.updated_at,
    version: q.version,
    structureId: q.structure_id || ( (q.quote_items || []).some((item: any) => (item.description === 'STRUCTURE' || item.description.startsWith('STRUCTURE ')) && Number(item.qty) > 0) ? 'custom' : null ),
    structurePricingMode: q.structure_pricing_mode || 'weight',
    solarMeterId: q.solar_meter_id || ( (q.quote_items || []).some((item: any) => item.description === 'SOLAR METER' && Number(item.qty) > 0) ? 'custom' : null ),
    solarMeterQty: q.solar_meter_qty || 1,
    netMeterId: q.net_meter_id || ( (q.quote_items || []).some((item: any) => item.description === 'NET METER' && Number(item.qty) > 0) ? 'custom' : null ),
    netMeterQty: q.net_meter_qty || 1,
    lightningArresterId: q.la_id || ( (q.quote_items || []).some((item: any) => (item.description === 'L/A' || item.description === 'LIGHTNING ARRESTER') && Number(item.qty) > 0) ? 'custom' : null ),
    lightningArresterQty: q.la_qty || 1,
    gstOnOutputOverride: q.gst_output_override,
    targetMRPInclGST: q.target_mrp_incl_gst,
    targetMRPPerWatt: q.target_mrp_per_watt,

    company_cin: q.company_cin || undefined,
    company_gstin: q.company_gstin || undefined,
    company_pan: q.company_pan || undefined,
    company_phone: q.company_phone || undefined,
    company_email: q.company_email || undefined,
    company_website: q.company_website || undefined,
    company_address: q.company_address || undefined,
    ceo_name: q.ceo_name || undefined,
    ceo_designation: q.ceo_designation || undefined,
    ceo_signature_url: q.ceo_signature_url || undefined,
    sales_exec_role: q.sales_exec_role || undefined,
    sales_exec_phone: q.sales_exec_phone || undefined,
    sales_exec_email: q.sales_exec_email || undefined,
    sales_exec_id: q.exec_id || undefined,
    bank_account_holder: q.bank_account_holder || undefined,
    bank_name: q.bank_name || undefined,
    bank_account_no: q.bank_account_no || undefined,
    bank_ifsc: q.bank_ifsc || undefined,
    bank_upi_id: q.bank_upi_id || undefined,
    terms_json: q.terms_json || undefined,
    why_solar_json: q.why_solar_json || undefined,
  } as Quote
}

// ─── Fetch All Quotes Query ──────────────────────────────────────────────────

export function useQuotesQuery(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['quotes'],
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Unauthorized')

      const { ProfileORM } = await import('../../backend/orm/profile')
      const profile = await ProfileORM.getById(session.user.id)
      const orgId = profile.org_id

      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*), quote_additional_costs(*), quote_status_history(*)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error
      const mapped = (data || []).map(mapDbQuoteToQuote)
      
      // Keep store quotes list in sync for calculator logic fallback
      useCalculatorStore.setState({ quotes: mapped })
      
      return mapped
    },
  })
}

// ─── Delete Quote Mutation ───────────────────────────────────────────────────

export function useDeleteQuoteMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Unauthorized')

      const { ProfileORM } = await import('../../backend/orm/profile')
      const profile = await ProfileORM.getById(session.user.id)
      const orgId = profile.org_id

      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('quote_number', quoteId)
        .eq('org_id', orgId)
      if (error) throw error

      // Delete JSON from Supabase Storage bucket
      try {
        const filePath = `${orgId}/${quoteId}.json`
        const { error: deleteError } = await supabase.storage
          .from('quotes')
          .remove([filePath])
        if (deleteError) {
          console.error('[useQuotes] Failed to delete quote JSON from storage bucket:', deleteError.message || deleteError)
        } else {
          console.log(`[useQuotes] Successfully deleted quote JSON from storage bucket: ${filePath}`)
        }
      } catch (err) {
        console.error('[useQuotes] Error deleting quote JSON from storage bucket:', err)
      }

      return quoteId
    },
    // Optimistic Update
    onMutate: async (quoteId) => {
      await queryClient.cancelQueries({ queryKey: ['quotes'] })
      const previousQuotes = queryClient.getQueryData<Quote[]>(['quotes'])

      if (previousQuotes) {
        queryClient.setQueryData<Quote[]>(
          ['quotes'],
          previousQuotes.filter((q) => q.quoteId !== quoteId)
        )
      }

      // Sync Zustand store
      const currentStoreQuotes = useCalculatorStore.getState().quotes || []
      useCalculatorStore.setState({
        quotes: currentStoreQuotes.filter((q) => q.quoteId !== quoteId)
      })

      return { previousQuotes }
    },
    onError: (err, quoteId, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(['quotes'], context.previousQuotes)
        useCalculatorStore.setState({ quotes: context.previousQuotes })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

// ─── Update Quote Status Mutation (with Cycle Status support) ───────────────

export function useUpdateQuoteStatusMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ quoteId, newStatus }: { quoteId: string; newStatus: Quote['status'] }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Unauthorized')

      const { ProfileORM } = await import('../../backend/orm/profile')
      const profile = await ProfileORM.getById(session.user.id)
      const orgId = profile.org_id

      const { data: existingQuote, error: quoteFetchError } = await supabase
        .from('quotes')
        .select('id, version, status, org_id, final_customer_price')
        .eq('quote_number', quoteId)
        .eq('org_id', orgId)
        .single()

      if (quoteFetchError) throw quoteFetchError
      if (!existingQuote) throw new Error('Quote not found')
      
      const { error } = await supabase
        .from('quotes')
        .update({
          status: newStatus.toLowerCase() as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingQuote.id)
        .eq('org_id', orgId)
        .eq('version', existingQuote.version)
      
      if (error) throw error

      // Write status history log
      const { error: historyErr } = await (supabase as any)
        .from('quote_status_history')
        .insert({
          org_id: existingQuote.org_id,
          quote_id: existingQuote.id,
          old_status: existingQuote.status,
          new_status: newStatus.toLowerCase() as any,
          changed_at: new Date().toISOString()
        })

      if (historyErr) {
        console.error('Error logging quote status history:', historyErr)
      }

      return { quoteId, newStatus }
    },
    // Optimistic Update
    onMutate: async ({ quoteId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['quotes'] })
      const previousQuotes = queryClient.getQueryData<Quote[]>(['quotes'])

      let nextQuotes: Quote[] = []

      if (previousQuotes) {
        nextQuotes = previousQuotes.map((q) => {
          if (q.quoteId !== quoteId) return q
          const changedAt = new Date().toISOString()
          const existingHistory = q.statusHistory?.length
            ? q.statusHistory
            : [{ status: q.status, changedAt: q.createdAt }]
          return {
            ...q,
            status: newStatus,
            statusHistory: [...existingHistory, { status: newStatus, changedAt }],
            updatedAt: changedAt,
          }
        })
        queryClient.setQueryData<Quote[]>(['quotes'], nextQuotes)
      }

      // Sync Zustand store
      const currentStoreQuotes = useCalculatorStore.getState().quotes || []
      useCalculatorStore.setState({
        quotes: currentStoreQuotes.map((q) => {
          if (q.quoteId !== quoteId) return q
          const changedAt = new Date().toISOString()
          return {
            ...q,
            status: newStatus,
            updatedAt: changedAt,
          }
        })
      })

      return { previousQuotes }
    },
    onError: (err, variables, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(['quotes'], context.previousQuotes)
        useCalculatorStore.setState({ quotes: context.previousQuotes })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useReviseQuoteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ originalQuoteId, revisionReason, surveyId }: { originalQuoteId: string, revisionReason: string, surveyId?: string }) => {
      return await reviseQuote(originalQuoteId, revisionReason, surveyId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    }
  })
}

