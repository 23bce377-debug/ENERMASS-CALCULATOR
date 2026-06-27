import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase/client'
import type { Quote } from '../types/quote'
import { useCalculatorStore } from '../store/calculatorStore'
import { SurveyORM } from '../../backend/orm/survey'
import { reviseQuote } from '../quotes/reviseQuote'

// Map a DB quote row to the frontend Quote type
function mapDbQuoteToQuote(q: any): Quote {
  const overrides: any = {}
  ;(q.quote_items || []).forEach((item: any) => {
    if (item.is_qty_overridden || item.is_rate_overridden || item.is_gst_overridden) {
      overrides[item.sort_order] = {
        qty: item.is_qty_overridden ? Number(item.qty) : undefined,
        ratePerUnit: item.is_rate_overridden ? Number(item.rate_per_unit) : undefined,
        gstPct: item.is_gst_overridden ? Number(item.gst_pct) : undefined,
      }
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
      effectiveGstPct: Number(item.gst_pct),
      lineTotal: Number(item.line_total),
      lineGST: Number(item.line_gst),
      lineSubTotal: Number(item.line_subtotal),
      isOverridden: item.is_qty_overridden || item.is_rate_overridden || !!item.is_gst_overridden,
      isDisabled: !item.is_included,
    })),
    costBeforeGST: Number(q.cost_before_gst),
    totalInputGST: Number(q.total_input_gst),
    totalIncGST: Number(q.total_incl_gst),
    effectiveMarginPct: Number(q.effective_margin_pct),
    mrpExclGST: Number(q.mrp_excl_gst),
    marginAmount: Number(q.mrp_excl_gst) - Number(q.cost_before_gst),
    gstOutputRate: Number(q.gst_output_rate),
    mrpInclGST: Number(q.mrp_incl_gst),
    discountAmount: Number(q.discount_amount),
    finalCustomerPrice: Number(q.final_customer_price),
    subsidyAmount: Number(q.subsidy_amount),
    beneficiaryContribution: Number(q.beneficiary_contribution),
    additionalCostTotal: Number(q.additional_costs_total),
    perKWexclGST: Number(q.per_kw_excl_gst || 0),
    perKWinclGST: Number(q.per_kw_incl_gst || 0),
    dailyGenerationKWh: Number(q.annual_generation_kwh || 0) / 365,
    monthlyGenerationKWh: Number(q.annual_generation_kwh || 0) / 12,
    annualGenerationKWh: Number(q.annual_generation_kwh || 0),
    monthlySavingsINR: Number(q.annual_savings_inr || 0) / 12,
    annualSavingsINR: Number(q.annual_savings_inr || 0),
    paybackYears: Number(q.payback_years || 0),
    lcoe: 0,
  }

  return {
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
    systemName: q.system_name || '',
    category: (q.system_category || '').replace('_', '-'),
    selectedState: q.state_name || 'Gujarat',
    equipment: {
      panelBrandId: q.panel_brand_model || undefined,
      inverterBrandId: q.inverter_brand_model || undefined,
      batteryBrandId: q.battery_brand_model || undefined,
    },
    additionalCosts: (q.quote_additional_costs || []).map((c: any) => ({
      id: c.id,
      description: c.description,
      amount: Number(c.amount),
    })),
    discountType: q.discount_type,
    discountVal: Number(q.discount_val),
    overrides,
    disabledItemIndices,
    targetMarginPct: Number(q.effective_margin_pct),
    calculations,
    status: (q.status === 'draft' ? 'Draft' : q.status === 'sent' ? 'Sent' : q.status === 'won' ? 'Won' : 'Lost') as any,
    statusHistory: q.quote_status_history?.length
      ? q.quote_status_history.map((h: any) => ({
          status: (h.new_status === 'draft' ? 'Draft' : h.new_status === 'sent' ? 'Sent' : h.new_status === 'won' ? 'Won' : 'Lost') as any,
          changedAt: h.changed_at,
        })).sort((a: any, b: any) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
      : [{ status: (q.status === 'draft' ? 'Draft' : q.status === 'sent' ? 'Sent' : q.status === 'won' ? 'Won' : 'Lost') as any, changedAt: q.updated_at || q.created_at }],
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

export function useQuotesQuery() {
  return useQuery({
    queryKey: ['quotes'],
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
      const { data: existingQuote } = await supabase
        .from('quotes')
        .select('id, version, status, org_id, survey_id, lead_id, final_customer_price')
        .eq('quote_number', quoteId)
        .single()
      
      if (!existingQuote) throw new Error('Quote not found')
      
      // ── Survey Gate: Draft → Sent requires completed/waived survey ──
      if (newStatus === 'Sent' && existingQuote.status === 'draft') {
        const gate = await SurveyORM.checkGate(quoteId)
        if (gate.blocked) {
          // Fetch lead_id to pass to the modal
          const { data: qWithLead } = await supabase
            .from('quotes')
            .select('lead_id')
            .eq('quote_number', quoteId)
            .maybeSingle()
          const err = new Error('Site survey required before sending this quote to the customer.')
          ;(err as any).code = 'SURVEY_GATE_BLOCKED'
          ;(err as any).leadId = qWithLead?.lead_id ?? null
          ;(err as any).orgId = existingQuote.org_id
          throw err
        }
      }

      // ── Survey Gate: Sent → Won requires survey_id on quote OR waived survey ──
      if (newStatus === 'Won') {
        let isWaived = false;
        if (existingQuote.lead_id) {
          const { data: leadSurvey } = await supabase
            .from('crm_site_surveys')
            .select('status')
            .eq('lead_id', existingQuote.lead_id)
            .eq('status', 'waived')
            .maybeSingle();
          if (leadSurvey) isWaived = true;
        }

        if (!isWaived && !existingQuote.survey_id) {
          throw new Error('BOM not verified against site survey. Revision required.');
        }
      }
      
      const { error } = await supabase
        .from('quotes')
        .update({
          status: newStatus.toLowerCase() as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingQuote.id)
        .eq('version', existingQuote.version)
      
      if (error) throw error

      if (newStatus === 'Won') {
        const total = existingQuote.final_customer_price || 0;
        const milestones = [
          {
            quote_id: existingQuote.id,
            milestone_name: 'Order Confirmation',
            trigger_event: 'order_confirmed',
            percent: 50,
            amount: Math.round(total * 0.50)
          },
          {
            quote_id: existingQuote.id,
            milestone_name: 'Material Delivery to Site',
            trigger_event: 'site_delivery',
            percent: 30,
            amount: Math.round(total * 0.30)
          },
          {
            quote_id: existingQuote.id,
            milestone_name: 'Installation Complete',
            trigger_event: 'installation',
            percent: 15,
            amount: Math.round(total * 0.15)
          },
          {
            quote_id: existingQuote.id,
            milestone_name: 'DISCOM Commissioning',
            trigger_event: 'commissioning',
            percent: 5,
            amount: Math.round(total * 0.05)
          }
        ];
        
        const { error: msError } = await supabase
          .from('payment_schedules')
          .insert(milestones);
          
        if (msError) {
          console.error('Error generating payment schedules:', msError);
        }
      }

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
            version: (q.version ?? 1) + 1,
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
            version: (q.version ?? 1) + 1,
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

