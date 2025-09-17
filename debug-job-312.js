require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugJob312() {
  try {
    console.log('🔍 Debugging job 312...\n');

    // Find the job with job_id "312"
    const { data: jobs, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', '312');

    if (jobError || !jobs.length) {
      console.error('❌ Could not find job with job_id 312:', jobError);
      return;
    }

    const job = jobs[0];
    console.log(`📋 Found job: ${job.id}`);
    console.log(`   Job ID: ${job.job_id}`);
    console.log(`   Venue: ${job.venue}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Created: ${job.created_at}\n`);

    // Check documents
    const { data: documents, error: docsError } = await supabase
      .from('job_documents')
      .select('*')
      .eq('job_id', job.id);

    if (docsError) {
      console.error('❌ Error fetching documents:', docsError);
      return;
    }

    console.log(`📄 Documents (${documents.length} total):`);
    documents.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.file_name} (${doc.file_type})`);
    });

    // Check extraction results
    const { data: extractions, error: extractError } = await supabase
      .from('extraction_results')
      .select('*')
      .eq('job_id', job.id);

    if (extractError) {
      console.error('❌ Error fetching extractions:', extractError);
      return;
    }

    console.log(`\n🔍 Extraction results (${extractions.length} total):`);
    extractions.forEach((ext, index) => {
      console.log(`   ${index + 1}. ID: ${ext.id}`);
      console.log(`      Status: ${ext.extraction_status}`);
      console.log(`      Items: ${ext.item_count}`);
      console.log(`      Created: ${ext.created_at}`);
    });

    // Check menu items for latest extraction
    if (extractions.length > 0) {
      const latestExtraction = extractions[extractions.length - 1];

      const { data: menuItems, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, subcategory, extraction_id')
        .eq('job_id', job.id)
        .eq('extraction_id', latestExtraction.id);

      if (menuError) {
        console.error('❌ Error fetching menu items:', menuError);
        return;
      }

      console.log(`\n🍽️  Menu items for latest extraction (${menuItems.length} found):`);
      if (menuItems.length === 0) {
        console.log('   ❌ NO ITEMS FOUND! This explains why table is empty.');

        // Check if items exist without extraction_id filter
        const { data: allItems, error: allError } = await supabase
          .from('menu_items')
          .select('id, name, extraction_id')
          .eq('job_id', job.id);

        if (!allError && allItems.length > 0) {
          console.log(`\n🤔 But found ${allItems.length} items for this job without extraction_id filter:`);
          const extractionIds = [...new Set(allItems.map(item => item.extraction_id))];
          console.log(`   Extraction IDs in items: ${extractionIds.join(', ')}`);
          console.log(`   Latest extraction ID: ${latestExtraction.id}`);
        }
      } else {
        console.log('   ✅ Items found and should display in table:');
        menuItems.slice(0, 5).forEach((item, index) => {
          console.log(`      ${index + 1}. ${item.name} (${item.subcategory})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugJob312();