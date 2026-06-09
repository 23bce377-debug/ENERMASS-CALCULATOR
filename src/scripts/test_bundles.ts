import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { allocateBundlePrice } from '../lib/engine/bundleAllocation';
import { createClient } from '@supabase/supabase-js';

// Setup admin client to create/clean test records
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runTests() {
  console.log('═══ PROCUREMENT BUNDLE ALLOCATION TEST SUITE ═══\n');

  // --- 1. Pure Function Maths Verification ---
  console.log('--- 1. Testing Allocation Engine Math ---');
  
  const testItems = [
    { item_description: 'Panel A', category: 'solar_panels', qty: 10, base_cost: 2000, gst_pct: 0.05 },
    { item_description: 'Inverter B', category: 'power_electronics', qty: 2, base_cost: 15000, gst_pct: 0.12 },
    { item_description: 'Cable C', category: 'cabling', qty: 100, base_cost: 100, gst_pct: 0.18 }
  ];

  // Strategy: proportional_cost
  // Total base cost = 10*2000 + 2*15000 + 100*100 = 20000 + 30000 + 10000 = 60000
  // Bundle price = 45000
  // Panel A total share = 45000 * 20000 / 60000 = 15000. Rate = 1500
  // Inverter B total share = 45000 * 30000 / 60000 = 22500. Rate = 11250
  // Cable C total share = 45000 * 10000 / 60000 = 7500. Rate = 75
  const resultCost = allocateBundlePrice(45000, testItems, 'proportional_cost');
  const sumCost = resultCost.reduce((sum, item) => sum + item.allocated_total, 0);
  console.log(`[proportional_cost] Sum allocated: ${sumCost} (Expected: 45000)`);
  if (Math.abs(sumCost - 45000) > 0.001) throw new Error('proportional_cost math failed');
  if (resultCost[0].rate_per_unit !== 1500) throw new Error('Panel A allocation incorrect');
  if (resultCost[1].rate_per_unit !== 11250) throw new Error('Inverter B allocation incorrect');
  if (resultCost[2].rate_per_unit !== 75) throw new Error('Cable C allocation incorrect');
  console.log('✅ proportional_cost math passed!');

  // Strategy: proportional_qty
  // Total qty = 10 + 2 + 100 = 112
  // Panel A share = 45000 * 10 / 112 = 4017.857
  // Inverter B share = 45000 * 2 / 112 = 803.571
  // Cable C share = 45000 * 100 / 112 = 40178.571
  const resultQty = allocateBundlePrice(45000, testItems, 'proportional_qty');
  const sumQty = resultQty.reduce((sum, item) => sum + item.allocated_total, 0);
  console.log(`[proportional_qty] Sum allocated: ${sumQty} (Expected: 45000)`);
  if (Math.abs(sumQty - 45000) > 0.001) throw new Error('proportional_qty math failed');
  console.log('✅ proportional_qty math passed!');

  // Strategy: manual (with overrides)
  // Panel A override = 1000. Total override = 10*1000 = 10000
  // Inverter B override = 12000. Total override = 2*12000 = 24000
  // Cable C override = 60. Total override = 100*60 = 6000
  // Total override sum = 40000. Effective Bundle Price = 48000
  // Scaling factor = 48000 / 40000 = 1.2
  // Panel A rate should be 1000 * 1.2 = 1200
  const manualItems = testItems.map((it, idx) => ({
    ...it,
    allocated_cost_override: idx === 0 ? 1000 : idx === 1 ? 12000 : 60
  }));
  const resultManual = allocateBundlePrice(48000, manualItems, 'manual');
  const sumManual = resultManual.reduce((sum, item) => sum + item.allocated_total, 0);
  console.log(`[manual] Sum allocated: ${sumManual} (Expected: 48000)`);
  if (Math.abs(sumManual - 48000) > 0.001) throw new Error('manual math failed');
  if (resultManual[0].rate_per_unit !== 1200) throw new Error('Manual scale incorrect for Panel A');
  console.log('✅ manual math passed!');

  // --- 2. Database & Trigger Flow Verification ---
  console.log('\n--- 2. Testing Supabase Database Integrations ---');
  
  // Pick an organisation id from DB
  const { data: orgs } = await supabaseAdmin.from('organisations').select('id').limit(1);
  if (!orgs || orgs.length === 0) {
    console.log('⚠️ No organisations found in database. Skipping DB integration test.');
    return;
  }
  const orgId = orgs[0].id;

  // Pick a profile id
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('org_id', orgId).limit(1);
  const userId = profiles?.[0]?.id || null;

  console.log(`Using Org ID: ${orgId}, User ID: ${userId}`);

  // Create a test vendor
  const { data: vendor, error: venErr } = await supabaseAdmin
    .from('vendors')
    .insert({ org_id: orgId, name: 'TEST_VENDOR_INTEGRATION_TEST' })
    .select()
    .single();
  if (venErr) throw venErr;
  console.log(`Created test vendor: ${vendor.name} (${vendor.id})`);

  try {
    // Create a test bundle preset
    const { data: preset, error: prsErr } = await supabaseAdmin
      .from('bundle_presets')
      .insert({
        org_id: orgId,
        vendor_id: vendor.id,
        name: 'TEST_BUNDLE_PRESET',
        effective_bundle_price: 30000,
        allocation_strategy: 'proportional_cost',
        created_by: userId,
        is_active: true
      })
      .select()
      .single();
    if (prsErr) throw prsErr;

    // Create preset child items
    const presetItems = [
      { bundle_preset_id: preset.id, item_description: 'TEST_PANEL_ITEM', category: 'solar_panels', qty: 4, unit: 'Nos', base_cost: 5000, gst_pct: 0.05 },
      { bundle_preset_id: preset.id, item_description: 'TEST_CABLE_ITEM', category: 'cabling', qty: 50, unit: 'Mtr', base_cost: 200, gst_pct: 0.18 }
    ];
    // Total base cost: 4*5000 + 50*200 = 20000 + 10000 = 30000.
    // Since effective price is 30000, rates should allocate exactly to base costs.
    const { error: itemsErr } = await supabaseAdmin.from('bundle_preset_items').insert(presetItems);
    if (itemsErr) throw itemsErr;
    console.log('Created test bundle preset & child items');

    // Create an acquisition order applying this bundle
    const bundleData = {
      bundle_preset_id: preset.id,
      name: preset.name,
      qty: 2, // We buy 2 bundle packages
      effective_bundle_price: 30000,
      allocation_strategy: preset.allocation_strategy as any,
      gst_pct: 0.18,
      items: presetItems
    };

    // Insert purchase order
    const { data: acq, error: acqErr } = await supabaseAdmin
      .from('acquisitions')
      .insert({
        org_id: orgId,
        vendor_id: vendor.id,
        invoice_number: 'TEST-INV-999',
        invoice_date: new Date().toISOString().split('T')[0],
        total_amount: 72600, // (30000 * 2) + GST
        status: 'pending'
      })
      .select()
      .single();
    if (acqErr) throw acqErr;

    // Insert acquisition bundle record
    const { data: acqBundle, error: acqBundleErr } = await supabaseAdmin
      .from('acquisition_bundles')
      .insert({
        acquisition_id: acq.id,
        bundle_preset_id: preset.id,
        name: bundleData.name,
        qty: bundleData.qty,
        effective_bundle_price: bundleData.effective_bundle_price,
        allocation_strategy: bundleData.allocation_strategy,
        gst_pct: bundleData.gst_pct
      })
      .select()
      .single();
    if (acqBundleErr) throw acqBundleErr;

    // Insert allocated items
    const allocated = allocateBundlePrice(bundleData.effective_bundle_price, bundleData.items, bundleData.allocation_strategy);
    const itemsToInsert = allocated.map(item => ({
      acquisition_id: acq.id,
      acquisition_bundle_id: acqBundle.id,
      item_description: item.item_description,
      category: item.category,
      qty: bundleData.qty * item.qty, // 2 * 4 = 8 panels, 2 * 50 = 100 meters
      unit: item.unit || 'Nos',
      rate_per_unit: item.rate_per_unit, // 5000, 200
      gst_pct: item.gst_pct
    }));

    const { error: acqItemsErr } = await supabaseAdmin.from('acquisition_items').insert(itemsToInsert);
    if (acqItemsErr) throw acqItemsErr;
    console.log('Created test Purchase Order with applied bundle');

    // Fetch and verify acquisition_items
    const { data: verifiedItems } = await supabaseAdmin
      .from('acquisition_items')
      .select('*')
      .eq('acquisition_id', acq.id);
    
    if (!verifiedItems || verifiedItems.length !== 2) throw new Error('Acquisition items count mismatch');
    const panelItem = verifiedItems.find(i => i.item_description === 'TEST_PANEL_ITEM')!;
    const cableItem = verifiedItems.find(i => i.item_description === 'TEST_CABLE_ITEM')!;
    if (panelItem.qty !== 8 || panelItem.rate_per_unit !== 5000) throw new Error('Allocated panel PO details incorrect');
    if (cableItem.qty !== 100 || cableItem.rate_per_unit !== 200) throw new Error('Allocated cable PO details incorrect');
    console.log('✅ Acquisition items rates matching allocation math!');

    // Mark as received using RPC
    console.log('Triggering mark_acquisition_as_received...');
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('mark_acquisition_as_received', {
      p_acquisition_id: acq.id,
      p_org_id: orgId
    });
    if (rpcErr) throw rpcErr;
    console.log('Acquisition marked received. Trigger updates stock level in background.');

    // Fetch inventory summary and check WAC
    const { data: invSummary } = await supabaseAdmin
      .from('inventory_summary')
      .select('*')
      .eq('org_id', orgId)
      .in('item_description', ['TEST_PANEL_ITEM', 'TEST_CABLE_ITEM']);

    if (!invSummary || invSummary.length !== 2) throw new Error('Inventory summary entries missing after receipt');
    const panelSummary = invSummary.find(i => i.item_description === 'TEST_PANEL_ITEM')!;
    const cableSummary = invSummary.find(i => i.item_description === 'TEST_CABLE_ITEM')!;

    console.log(`[Inventory WAC] TEST_PANEL_ITEM: Qty=${panelSummary.current_qty}, WAC=${panelSummary.weighted_avg_cost}`);
    console.log(`[Inventory WAC] TEST_CABLE_ITEM: Qty=${cableSummary.current_qty}, WAC=${cableSummary.weighted_avg_cost}`);

    if (Number(panelSummary.current_qty) < 8 || Number(panelSummary.weighted_avg_cost) !== 5000) {
      throw new Error('Panel inventory summary not updated correctly');
    }
    if (Number(cableSummary.current_qty) < 100 || Number(cableSummary.weighted_avg_cost) !== 200) {
      throw new Error('Cable inventory summary not updated correctly');
    }
    console.log('✅ Inventory ledger and summary (WAC) trigger verified!');

    // Clean up test data
    console.log('Cleaning up test records...');
    await supabaseAdmin.from('acquisitions').delete().eq('id', acq.id);
    await supabaseAdmin.from('bundle_presets').delete().eq('id', preset.id);
    await supabaseAdmin.from('inventory_summary').delete().eq('org_id', orgId).in('item_description', ['TEST_PANEL_ITEM', 'TEST_CABLE_ITEM']);
    console.log('✅ Cleanup finished successfully!');

  } finally {
    // Delete the test vendor at the end
    await supabaseAdmin.from('vendors').delete().eq('id', vendor.id);
  }

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
