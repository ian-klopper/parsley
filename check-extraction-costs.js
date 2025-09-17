require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkExtractionCosts() {
  try {
    console.log('🔍 Checking extraction costs in database...\n');

    // Get all extraction results with costs
    const { data: extractions, error } = await supabase
      .from('extraction_results')
      .select('id, job_id, item_count, extraction_cost, api_calls_count, processing_time_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching extractions:', error);
      return;
    }

    console.log(`📊 Latest extraction results (${extractions.length} found):\n`);

    extractions.forEach((ext, index) => {
      console.log(`${index + 1}. Extraction ID: ${ext.id}`);
      console.log(`   Job ID: ${ext.job_id}`);
      console.log(`   Items: ${ext.item_count}`);
      console.log(`   Cost: $${ext.extraction_cost || 0}`);
      console.log(`   API Calls: ${ext.api_calls_count || 0}`);
      console.log(`   Processing Time: ${ext.processing_time_ms || 0}ms`);
      console.log(`   Created: ${ext.created_at}`);
      console.log('');
    });

    // Check the specific job we just ran
    const jobId = 'e390fe09-454a-4391-a57f-932480f04ba1';
    const { data: jobExtractions, error: jobError } = await supabase
      .from('extraction_results')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (jobError) {
      console.error('❌ Error fetching job extractions:', jobError);
      return;
    }

    console.log(`🎯 Extractions for job ${jobId}:`);
    if (jobExtractions.length === 0) {
      console.log('   ❌ No extractions found for this job');
    } else {
      jobExtractions.forEach((ext, index) => {
        console.log(`   ${index + 1}. Cost: $${ext.extraction_cost || 0} | API Calls: ${ext.api_calls_count || 0} | Status: ${ext.extraction_status}`);
      });
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkExtractionCosts();