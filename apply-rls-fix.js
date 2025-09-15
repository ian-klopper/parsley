const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read the SQL file
const sqlContent = fs.readFileSync('./database/clean/FIX-RLS-POLICIES.sql', 'utf8');

// Create Supabase client with service role key
const supabase = createClient(
  'https://drwytmbsonrfbzxpjkzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao'
);

async function applyFix() {
  try {
    console.log('Applying RLS policy fixes...');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });

    if (error) {
      console.error('Error applying fixes:', error);
      // Try executing as raw SQL instead
      const { data: rawData, error: rawError } = await supabase
        .from('_postgrest')
        .select()
        .eq('sql', sqlContent);

      if (rawError) {
        console.error('Raw SQL error:', rawError);
      } else {
        console.log('SQL executed successfully via raw query');
      }
    } else {
      console.log('RLS policy fixes applied successfully!');
      console.log('Result:', data);
    }
  } catch (err) {
    console.error('Script error:', err);
  }
}

applyFix().then(() => {
  console.log('Script completed');
  process.exit(0);
});