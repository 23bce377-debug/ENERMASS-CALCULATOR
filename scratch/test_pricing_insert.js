const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://xjdqpwmizmfkcdcgcxqv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHFwd21pem1ma2NkY2djeHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTUzNTQsImV4cCI6MjA5NTUzMTM1NH0.HtvjO-Ry3m3Rd1gTYhZ8KIisGouRU47-iwGzOW_pGtk"
);

async function run() {
  console.log("Signing in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'demo123@gmail.com',
    password: 'admin123'
  });

  if (authError) {
    console.error("Auth failed:", authError.message);
    return;
  }

  const user = authData.user;
  console.log("Logged in successfully! User ID:", user.id);

  // Fetch profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error("Profile fetch failed:", profileError.message);
    return;
  }

  console.log("Profile org_id:", profile.org_id);

  // Get a global BOM item
  const { data: boms, error: bomError } = await supabase
    .from('eq_bom_items')
    .select('*')
    .is('org_id', null)
    .limit(1);

  if (bomError) {
    console.error("BOM item fetch failed:", bomError.message);
    return;
  }

  if (!boms || boms.length === 0) {
    console.log("No global BOM items found.");
    return;
  }

  const targetItem = boms[0];
  console.log("Target global item:", targetItem.description, "(id:", targetItem.id, ")");

  // Try insert override
  console.log("Trying to insert pricing override...");
  const overrideData = {
    org_id: profile.org_id,
    section: targetItem.section,
    sub_type: targetItem.sub_type,
    description: targetItem.description,
    remarks: targetItem.remarks,
    unit: targetItem.unit,
    buy_price: targetItem.buy_price,
    selling_price: 125, // custom price
    gst_pct: targetItem.gst_pct,
    is_active: true
  };

  const { data: inserted, error: insertError } = await supabase
    .from('eq_bom_items')
    .insert(overrideData)
    .select()
    .single();

  if (insertError) {
    console.error("Insert failed! Code:", insertError.code, "Message:", insertError.message);
  } else {
    console.log("Insert succeeded!", inserted);
    
    // Clean up
    const { error: deleteError } = await supabase
      .from('eq_bom_items')
      .delete()
      .eq('id', inserted.id);
    if (deleteError) {
      console.error("Failed to clean up inserted row:", deleteError.message);
    } else {
      console.log("Cleaned up successfully.");
    }
  }
}

run().catch(console.error);
