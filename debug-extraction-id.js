require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugExtractionId() {
  try {
    const jobId = '635214c5-9b7a-4cf5-918f-b67e64b34af1';

    console.log('🔍 Debugging extraction_id issue...\n');

    // Get extraction result ID
    const { data: extractionResult, error: extractionError } = await supabase
      .from('extraction_results')
      .select('id, extraction_status, item_count')
      .eq('job_id', jobId)
      .eq('extraction_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (extractionError) {
      console.error('❌ Error getting extraction result:', extractionError);
      return;
    }

    console.log(`✅ Found extraction result: ${extractionResult.id}`);
    console.log(`   Status: ${extractionResult.extraction_status}`);
    console.log(`   Item count: ${extractionResult.item_count}\n`);

    // Check menu items with extraction_id
    const { data: menuItemsWithExtraction, error: withExtractionError } = await supabase
      .from('menu_items')
      .select('id, name, job_id, extraction_id')
      .eq('job_id', jobId)
      .eq('extraction_id', extractionResult.id);

    console.log(`🔍 Menu items filtered by job_id AND extraction_id:`);
    if (withExtractionError) {
      console.error('❌ Error:', withExtractionError);
    } else {
      console.log(`   Found: ${menuItemsWithExtraction.length} items`);
    }

    // Check menu items with just job_id
    const { data: menuItemsJobOnly, error: jobOnlyError } = await supabase
      .from('menu_items')
      .select('id, name, job_id, extraction_id')
      .eq('job_id', jobId);

    console.log(`\n🔍 Menu items filtered by job_id ONLY:`);
    if (jobOnlyError) {
      console.error('❌ Error:', jobOnlyError);
    } else {
      console.log(`   Found: ${menuItemsJobOnly.length} items`);
      if (menuItemsJobOnly.length > 0) {
        console.log('   Sample extraction_id values:');
        menuItemsJobOnly.slice(0, 3).forEach((item, i) => {
          console.log(`     ${i + 1}. ${item.name}: extraction_id = ${item.extraction_id}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugExtractionId();