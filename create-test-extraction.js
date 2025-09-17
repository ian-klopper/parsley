require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestExtraction() {
  try {
    console.log('🧪 Creating test extraction record with cost data...\n');

    const jobId = 'e390fe09-454a-4391-a57f-932480f04ba1';

    // Create extraction result record
    const { data: extraction, error: extractionError } = await supabase
      .from('extraction_results')
      .insert({
        job_id: jobId,
        extraction_status: 'completed',
        item_count: 24,
        extraction_cost: 0.0457,  // Example cost: ~4.5 cents
        api_calls_count: 8,       // 4 Flash + 4 Pro calls
        processing_time_ms: 35445 // Time from logs
      })
      .select()
      .single();

    if (extractionError) {
      console.error('❌ Error creating extraction record:', extractionError);
      return;
    }

    console.log('✅ Created extraction record:', extraction);

    // Create some test menu items
    const menuItems = [
      { name: 'Crispy Calamari', subcategory: 'Appetizer', menus: 'General' },
      { name: 'Burrata Caprese', subcategory: 'Appetizer', menus: 'General' },
      { name: 'The Steakhouse Burger', subcategory: 'Burger', menus: 'General' },
      { name: 'Pan-Seared Salmon', subcategory: 'Entree', menus: 'General' },
      { name: 'Classic Caesar Salad', subcategory: 'Salad', menus: 'General' }
    ];

    for (const item of menuItems) {
      await supabase.from('menu_items').insert({
        job_id: jobId,
        extraction_id: extraction.id,
        ...item,
        description: `Delicious ${item.name.toLowerCase()}`
      });
    }

    console.log(`✅ Created ${menuItems.length} test menu items`);
    console.log('\n🎯 Test extraction ready! Check the job page to see cost display.');

  } catch (error) {
    console.error('❌ Test creation failed:', error);
  }
}

createTestExtraction();