-- Persist quote headers, BOM line items, and additional costs in one database
-- transaction. This prevents partial quote saves when quote_items integrity
-- triggers reject a row after the quote header was already updated.

CREATE OR REPLACE FUNCTION public.persist_quote_atomic(
  p_quote_data jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_costs jsonb DEFAULT '[]'::jsonb,
  p_existing_quote_id uuid DEFAULT NULL,
  p_expected_version integer DEFAULT NULL,
  p_force_overwrite boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote_id uuid;
  v_org_id uuid;
  v_version integer;
  v_item jsonb;
  v_cost jsonb;
BEGIN
  v_org_id := NULLIF(p_quote_data->>'org_id', '')::uuid;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Quote org_id is required';
  END IF;

  IF NOT (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(v_org_id)) THEN
    RAISE EXCEPTION 'Forbidden: quote does not belong to the active organisation';
  END IF;

  IF p_existing_quote_id IS NOT NULL THEN
    UPDATE public.quotes
    SET
      status = COALESCE((p_quote_data->>'status')::public.quote_status, status),
      project_type = COALESCE((p_quote_data->>'project_type')::public.project_type, project_type),
      company_cin = p_quote_data->>'company_cin',
      company_gstin = p_quote_data->>'company_gstin',
      company_pan = p_quote_data->>'company_pan',
      company_phone = p_quote_data->>'company_phone',
      company_email = p_quote_data->>'company_email',
      company_website = p_quote_data->>'company_website',
      company_address = p_quote_data->>'company_address',
      ceo_name = p_quote_data->>'ceo_name',
      ceo_designation = p_quote_data->>'ceo_designation',
      ceo_signature_url = p_quote_data->>'ceo_signature_url',
      sales_exec_role = p_quote_data->>'sales_exec_role',
      sales_exec_phone = p_quote_data->>'sales_exec_phone',
      sales_exec_email = p_quote_data->>'sales_exec_email',
      exec_id = NULLIF(p_quote_data->>'exec_id', '')::uuid,
      bank_account_holder = p_quote_data->>'bank_account_holder',
      bank_name = p_quote_data->>'bank_name',
      bank_account_no = p_quote_data->>'bank_account_no',
      bank_ifsc = p_quote_data->>'bank_ifsc',
      bank_upi_id = p_quote_data->>'bank_upi_id',
      terms_json = p_quote_data->'terms_json',
      why_solar_json = p_quote_data->'why_solar_json',
      customer_name = COALESCE(p_quote_data->>'customer_name', customer_name),
      customer_phone = p_quote_data->>'customer_phone',
      customer_whatsapp = p_quote_data->>'customer_whatsapp',
      customer_email = p_quote_data->>'customer_email',
      address_line1 = p_quote_data->>'address_line1',
      address_line2 = p_quote_data->>'address_line2',
      city = p_quote_data->>'city',
      state_name = p_quote_data->>'state_name',
      pincode = p_quote_data->>'pincode',
      meter_number = p_quote_data->>'meter_number',
      sanctioned_load_kw = NULLIF(p_quote_data->>'sanctioned_load_kw', '')::numeric,
      monthly_bill_inr = NULLIF(p_quote_data->>'monthly_bill_inr', '')::numeric,
      roof_type = p_quote_data->>'roof_type',
      roof_area_sqft = NULLIF(p_quote_data->>'roof_area_sqft', '')::numeric,
      exec_name = p_quote_data->>'exec_name',
      sale_type = COALESCE((p_quote_data->>'sale_type')::public.sale_type, sale_type),
      project_title = p_quote_data->>'project_title',
      notes = p_quote_data->>'notes',
      system_id = NULLIF(p_quote_data->>'system_id', '')::uuid,
      system_name = p_quote_data->>'system_name',
      system_category = NULLIF(p_quote_data->>'system_category', '')::public.system_category,
      system_capacity_kw = NULLIF(p_quote_data->>'system_capacity_kw', '')::numeric,
      equipment_json = p_quote_data->'equipment_json',
      panel_brand_model = p_quote_data->>'panel_brand_model',
      panel_qty = NULLIF(p_quote_data->>'panel_qty', '')::numeric,
      inverter_brand_model = p_quote_data->>'inverter_brand_model',
      inverter_qty = NULLIF(p_quote_data->>'inverter_qty', '')::numeric,
      battery_brand_model = p_quote_data->>'battery_brand_model',
      battery_qty = NULLIF(p_quote_data->>'battery_qty', '')::numeric,
      discount_type = COALESCE((p_quote_data->>'discount_type')::public.discount_type, discount_type),
      discount_val = COALESCE(NULLIF(p_quote_data->>'discount_val', '')::numeric, 0),
      cost_before_gst = COALESCE(NULLIF(p_quote_data->>'cost_before_gst', '')::numeric, 0),
      total_input_gst = COALESCE(NULLIF(p_quote_data->>'total_input_gst', '')::numeric, 0),
      total_incl_gst = COALESCE(NULLIF(p_quote_data->>'total_incl_gst', '')::numeric, 0),
      effective_margin_pct = COALESCE(NULLIF(p_quote_data->>'effective_margin_pct', '')::numeric, 0),
      mrp_excl_gst = COALESCE(NULLIF(p_quote_data->>'mrp_excl_gst', '')::numeric, 0),
      gst_output_rate = COALESCE(NULLIF(p_quote_data->>'gst_output_rate', '')::numeric, 0),
      output_gst_amount = COALESCE(NULLIF(p_quote_data->>'output_gst_amount', '')::numeric, 0),
      mrp_incl_gst = COALESCE(NULLIF(p_quote_data->>'mrp_incl_gst', '')::numeric, 0),
      discount_amount = COALESCE(NULLIF(p_quote_data->>'discount_amount', '')::numeric, 0),
      additional_costs_total = COALESCE(NULLIF(p_quote_data->>'additional_costs_total', '')::numeric, 0),
      final_customer_price = COALESCE(NULLIF(p_quote_data->>'final_customer_price', '')::numeric, 0),
      subsidy_scheme_id = NULLIF(p_quote_data->>'subsidy_scheme_id', '')::uuid,
      subsidy_amount = COALESCE(NULLIF(p_quote_data->>'subsidy_amount', '')::numeric, 0),
      subsidy_breakdown = p_quote_data->>'subsidy_breakdown',
      subsidy_eligible = COALESCE((p_quote_data->>'subsidy_eligible')::boolean, false),
      beneficiary_contribution = COALESCE(NULLIF(p_quote_data->>'beneficiary_contribution', '')::numeric, 0),
      per_kw_excl_gst = NULLIF(p_quote_data->>'per_kw_excl_gst', '')::numeric,
      per_kw_incl_gst = NULLIF(p_quote_data->>'per_kw_incl_gst', '')::numeric,
      annual_generation_kwh = NULLIF(p_quote_data->>'annual_generation_kwh', '')::numeric,
      annual_savings_inr = NULLIF(p_quote_data->>'annual_savings_inr', '')::numeric,
      payback_years = NULLIF(p_quote_data->>'payback_years', '')::numeric,
      lifetime_savings_inr = NULLIF(p_quote_data->>'lifetime_savings_inr', '')::numeric,
      co2_offset_kg_per_year = NULLIF(p_quote_data->>'co2_offset_kg_per_year', '')::numeric,
      lead_id = NULLIF(p_quote_data->>'lead_id', '')::uuid,
      structure_id = NULLIF(p_quote_data->>'structure_id', '')::uuid,
      structure_pricing_mode = p_quote_data->>'structure_pricing_mode',
      solar_meter_id = NULLIF(p_quote_data->>'solar_meter_id', '')::uuid,
      solar_meter_qty = COALESCE(NULLIF(p_quote_data->>'solar_meter_qty', '')::numeric, 1),
      net_meter_id = NULLIF(p_quote_data->>'net_meter_id', '')::uuid,
      net_meter_qty = COALESCE(NULLIF(p_quote_data->>'net_meter_qty', '')::numeric, 1),
      la_id = NULLIF(p_quote_data->>'la_id', '')::uuid,
      la_qty = COALESCE(NULLIF(p_quote_data->>'la_qty', '')::numeric, 1),
      gst_output_override = NULLIF(p_quote_data->>'gst_output_override', '')::numeric,
      target_mrp_incl_gst = NULLIF(p_quote_data->>'target_mrp_incl_gst', '')::numeric,
      target_mrp_per_watt = NULLIF(p_quote_data->>'target_mrp_per_watt', '')::numeric,
      margin_mode = COALESCE(p_quote_data->>'margin_mode', margin_mode),
      target_margin_amount = NULLIF(p_quote_data->>'target_margin_amount', '')::numeric,
      validation_acknowledged = COALESCE(p_quote_data->'validation_acknowledged', '[]'::jsonb),
      updated_at = COALESCE(NULLIF(p_quote_data->>'updated_at', '')::timestamptz, now()),
      version = COALESCE(version, 1) + 1
    WHERE id = p_existing_quote_id
      AND org_id = v_org_id
      AND (p_force_overwrite OR p_expected_version IS NULL OR version = p_expected_version)
    RETURNING id, version INTO v_quote_id, v_version;

    IF v_quote_id IS NULL THEN
      RAISE EXCEPTION 'CONCURRENCY_CONFLICT';
    END IF;
  ELSE
    INSERT INTO public.quotes (
      org_id, quote_number, status, project_type,
      company_cin, company_gstin, company_pan, company_phone, company_email, company_website,
      company_address, ceo_name, ceo_designation, ceo_signature_url, sales_exec_role,
      sales_exec_phone, sales_exec_email, exec_id, bank_account_holder, bank_name, bank_account_no,
      bank_ifsc, bank_upi_id, terms_json, why_solar_json, customer_name, customer_phone,
      customer_whatsapp, customer_email, address_line1, address_line2, city, state_name, pincode,
      meter_number, sanctioned_load_kw, monthly_bill_inr, roof_type, roof_area_sqft, exec_name,
      sale_type, project_title, notes, system_id, system_name, system_category, system_capacity_kw,
      equipment_json, panel_brand_model, panel_qty, inverter_brand_model, inverter_qty,
      battery_brand_model, battery_qty, discount_type, discount_val, cost_before_gst,
      total_input_gst, total_incl_gst, effective_margin_pct, mrp_excl_gst, gst_output_rate,
      output_gst_amount, mrp_incl_gst, discount_amount, additional_costs_total, final_customer_price,
      subsidy_scheme_id, subsidy_amount, subsidy_breakdown, subsidy_eligible, beneficiary_contribution,
      per_kw_excl_gst, per_kw_incl_gst, annual_generation_kwh, annual_savings_inr, payback_years,
      lifetime_savings_inr, co2_offset_kg_per_year, created_by, created_at, updated_at, lead_id,
      structure_id, structure_pricing_mode, solar_meter_id, solar_meter_qty, net_meter_id, net_meter_qty,
      la_id, la_qty, gst_output_override, target_mrp_incl_gst, target_mrp_per_watt, margin_mode,
      target_margin_amount, validation_acknowledged
    ) VALUES (
      v_org_id, p_quote_data->>'quote_number', COALESCE((p_quote_data->>'status')::public.quote_status, 'draft'),
      COALESCE((p_quote_data->>'project_type')::public.project_type, 'residential'),
      p_quote_data->>'company_cin', p_quote_data->>'company_gstin', p_quote_data->>'company_pan',
      p_quote_data->>'company_phone', p_quote_data->>'company_email', p_quote_data->>'company_website',
      p_quote_data->>'company_address', p_quote_data->>'ceo_name', p_quote_data->>'ceo_designation',
      p_quote_data->>'ceo_signature_url', p_quote_data->>'sales_exec_role', p_quote_data->>'sales_exec_phone',
      p_quote_data->>'sales_exec_email', NULLIF(p_quote_data->>'exec_id', '')::uuid,
      p_quote_data->>'bank_account_holder', p_quote_data->>'bank_name', p_quote_data->>'bank_account_no',
      p_quote_data->>'bank_ifsc', p_quote_data->>'bank_upi_id', p_quote_data->'terms_json',
      p_quote_data->'why_solar_json', p_quote_data->>'customer_name', p_quote_data->>'customer_phone',
      p_quote_data->>'customer_whatsapp', p_quote_data->>'customer_email', p_quote_data->>'address_line1',
      p_quote_data->>'address_line2', p_quote_data->>'city', p_quote_data->>'state_name', p_quote_data->>'pincode',
      p_quote_data->>'meter_number', NULLIF(p_quote_data->>'sanctioned_load_kw', '')::numeric,
      NULLIF(p_quote_data->>'monthly_bill_inr', '')::numeric, p_quote_data->>'roof_type',
      NULLIF(p_quote_data->>'roof_area_sqft', '')::numeric, p_quote_data->>'exec_name',
      COALESCE((p_quote_data->>'sale_type')::public.sale_type, 'new'),
      p_quote_data->>'project_title', p_quote_data->>'notes', NULLIF(p_quote_data->>'system_id', '')::uuid,
      p_quote_data->>'system_name', NULLIF(p_quote_data->>'system_category', '')::public.system_category,
      NULLIF(p_quote_data->>'system_capacity_kw', '')::numeric, p_quote_data->'equipment_json',
      p_quote_data->>'panel_brand_model', NULLIF(p_quote_data->>'panel_qty', '')::numeric,
      p_quote_data->>'inverter_brand_model', NULLIF(p_quote_data->>'inverter_qty', '')::numeric,
      p_quote_data->>'battery_brand_model', NULLIF(p_quote_data->>'battery_qty', '')::numeric,
      COALESCE((p_quote_data->>'discount_type')::public.discount_type, 'none'),
      COALESCE(NULLIF(p_quote_data->>'discount_val', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'cost_before_gst', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'total_input_gst', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'total_incl_gst', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'effective_margin_pct', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'mrp_excl_gst', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'gst_output_rate', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'output_gst_amount', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'mrp_incl_gst', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'discount_amount', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'additional_costs_total', '')::numeric, 0),
      COALESCE(NULLIF(p_quote_data->>'final_customer_price', '')::numeric, 0),
      NULLIF(p_quote_data->>'subsidy_scheme_id', '')::uuid,
      COALESCE(NULLIF(p_quote_data->>'subsidy_amount', '')::numeric, 0),
      p_quote_data->>'subsidy_breakdown', COALESCE((p_quote_data->>'subsidy_eligible')::boolean, false),
      COALESCE(NULLIF(p_quote_data->>'beneficiary_contribution', '')::numeric, 0),
      NULLIF(p_quote_data->>'per_kw_excl_gst', '')::numeric,
      NULLIF(p_quote_data->>'per_kw_incl_gst', '')::numeric,
      NULLIF(p_quote_data->>'annual_generation_kwh', '')::numeric,
      NULLIF(p_quote_data->>'annual_savings_inr', '')::numeric,
      NULLIF(p_quote_data->>'payback_years', '')::numeric,
      NULLIF(p_quote_data->>'lifetime_savings_inr', '')::numeric,
      NULLIF(p_quote_data->>'co2_offset_kg_per_year', '')::numeric,
      NULLIF(p_quote_data->>'created_by', '')::uuid,
      COALESCE(NULLIF(p_quote_data->>'created_at', '')::timestamptz, now()),
      COALESCE(NULLIF(p_quote_data->>'updated_at', '')::timestamptz, now()),
      NULLIF(p_quote_data->>'lead_id', '')::uuid,
      NULLIF(p_quote_data->>'structure_id', '')::uuid, p_quote_data->>'structure_pricing_mode',
      NULLIF(p_quote_data->>'solar_meter_id', '')::uuid, COALESCE(NULLIF(p_quote_data->>'solar_meter_qty', '')::numeric, 1),
      NULLIF(p_quote_data->>'net_meter_id', '')::uuid, COALESCE(NULLIF(p_quote_data->>'net_meter_qty', '')::numeric, 1),
      NULLIF(p_quote_data->>'la_id', '')::uuid, COALESCE(NULLIF(p_quote_data->>'la_qty', '')::numeric, 1),
      NULLIF(p_quote_data->>'gst_output_override', '')::numeric,
      NULLIF(p_quote_data->>'target_mrp_incl_gst', '')::numeric,
      NULLIF(p_quote_data->>'target_mrp_per_watt', '')::numeric,
      COALESCE(p_quote_data->>'margin_mode', 'percent'),
      NULLIF(p_quote_data->>'target_margin_amount', '')::numeric,
      COALESCE(p_quote_data->'validation_acknowledged', '[]'::jsonb)
    )
    RETURNING id, version INTO v_quote_id, v_version;
  END IF;

  DELETE FROM public.quote_items WHERE quote_id = v_quote_id;
  DELETE FROM public.quote_additional_costs WHERE quote_id = v_quote_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS value LOOP
    INSERT INTO public.quote_items (
      quote_id, sort_order, section, description, remarks, unit, qty, rate_per_unit, gst_pct,
      original_qty, original_rate, original_gst, is_qty_overridden, is_rate_overridden,
      is_gst_overridden, is_included, is_mandatory, line_total, line_gst, line_subtotal,
      source_table, source_item_id, source_label, quoted_rate_date
    ) VALUES (
      v_quote_id,
      COALESCE(NULLIF(v_item->>'sort_order', '')::integer, 0),
      COALESCE((v_item->>'section')::public.bom_section, 'services'),
      COALESCE(v_item->>'description', 'Line Item'),
      v_item->>'remarks',
      COALESCE(v_item->>'unit', 'Nos'),
      COALESCE(NULLIF(v_item->>'qty', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'rate_per_unit', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'gst_pct', '')::numeric, 0),
      NULLIF(v_item->>'original_qty', '')::numeric,
      NULLIF(v_item->>'original_rate', '')::numeric,
      NULLIF(v_item->>'original_gst', '')::numeric,
      COALESCE((v_item->>'is_qty_overridden')::boolean, false),
      COALESCE((v_item->>'is_rate_overridden')::boolean, false),
      COALESCE((v_item->>'is_gst_overridden')::boolean, false),
      COALESCE((v_item->>'is_included')::boolean, true),
      COALESCE((v_item->>'is_mandatory')::boolean, false),
      COALESCE(NULLIF(v_item->>'line_total', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'line_gst', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'line_subtotal', '')::numeric, 0),
      v_item->>'source_table',
      NULLIF(v_item->>'source_item_id', '')::uuid,
      v_item->>'source_label',
      COALESCE(NULLIF(v_item->>'quoted_rate_date', '')::date, CURRENT_DATE)
    );
  END LOOP;

  FOR v_cost IN SELECT value FROM jsonb_array_elements(COALESCE(p_costs, '[]'::jsonb)) AS value LOOP
    INSERT INTO public.quote_additional_costs (quote_id, description, amount, sort_order)
    VALUES (
      v_quote_id,
      COALESCE(v_cost->>'description', 'Additional cost'),
      COALESCE(NULLIF(v_cost->>'amount', '')::numeric, 0),
      COALESCE(NULLIF(v_cost->>'sort_order', '')::integer, 0)
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_quote_id, 'version', v_version);
END;
$$;

GRANT EXECUTE ON FUNCTION public.persist_quote_atomic(jsonb, jsonb, jsonb, uuid, integer, boolean)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
