require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addExtractionCostFields() {
  try {
    console.log('🏗️  Adding cost tracking fields to extraction_results table...\n');

    // Add extraction_cost and api_calls_count fields
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add extraction cost field (stores cost in USD with 4 decimal precision)
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS extraction_cost DECIMAL(10,4) DEFAULT 0.0;

        -- Add API calls count field
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS api_calls_count INTEGER DEFAULT 0;

        -- Add processing_time_ms field for tracking extraction duration
        ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER DEFAULT 0;
      `
    });

    if (error) {
      console.error('❌ Failed to add cost fields:', error);
      return;
    }

    console.log('✅ Successfully added cost tracking fields to extraction_results table');
    console.log('   - extraction_cost (DECIMAL): Stores extraction cost in USD');
    console.log('   - api_calls_count (INTEGER): Tracks total API calls made');
    console.log('   - processing_time_ms (INTEGER): Tracks extraction duration');

    // Verify the fields were added
    const { data: tableInfo, error: infoError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'extraction_results'
        AND column_name IN ('extraction_cost', 'api_calls_count', 'processing_time_ms')
        ORDER BY column_name;
      `
    });

    if (!infoError && tableInfo) {
      console.log('\n📊 Field verification:');
      tableInfo.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

addExtractionCostFields();