require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  try {
    console.log('🔍 Checking database schema...\n');

    // Check what tables exist
    const { data: tables, error } = await supabase
      .rpc('get_schema_tables');

    if (error) {
      console.log('Using alternative method to check tables...');

      // Try to query information_schema directly
      const { data: tableList, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (tableError) {
        console.log('Checking tables by trying to query them individually...');

        const tablesToCheck = [
          'jobs',
          'job_documents',
          'extraction_results',
          'extracted_items',
          'menu_items',
          'items_sizes',
          'item_sizes',
          'menu_item_sizes',
          'item_modifiers'
        ];

        for (const table of tablesToCheck) {
          try {
            const { data, error } = await supabase
              .from(table)
              .select('*')
              .limit(0);

            if (error) {
              console.log(`❌ Table '${table}' does not exist or is not accessible`);
            } else {
              console.log(`✅ Table '${table}' exists`);
            }
          } catch (e) {
            console.log(`❌ Table '${table}' does not exist`);
          }
        }
      } else {
        console.log('📋 Available tables:');
        tableList.forEach(table => {
          console.log(`  - ${table.table_name}`);
        });
      }
    } else {
      console.log('📋 Schema tables:', tables);
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

checkSchema();