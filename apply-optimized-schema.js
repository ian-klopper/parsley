const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyOptimizedSchema() {
  console.log('🚀 Applying optimized database schema...');

  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('database/optimized/OPTIMIZED-DATABASE-SCHEMA.sql', 'utf8');

    // Split into individual statements (basic approach)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s !== '');

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}:`);
        console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

        try {
          const { error } = await supabase.rpc('exec', {
            sql: statement
          });

          if (error) {
            // Try direct query if RPC fails
            const { error: queryError } = await supabase
              .from('dual') // This will fail but might give us better error info
              .select('*');

            console.error(`❌ Error in statement ${i + 1}:`, error);
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        }
      }
    }

    console.log('🎉 Schema application completed!');

  } catch (error) {
    console.error('❌ Failed to apply schema:', error);
    process.exit(1);
  }
}

applyOptimizedSchema();