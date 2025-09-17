const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    // Add description column to activity_logs table
    const { data, error } = await supabase.rpc('query', {
      query: `
        ALTER TABLE activity_logs
        ADD COLUMN IF NOT EXISTS description TEXT;

        CREATE INDEX IF NOT EXISTS idx_activity_logs_description ON activity_logs(description);
      `
    });

    if (error) {
      console.error('Migration error:', error);
      return;
    }

    console.log('Migration completed successfully!');
    console.log('Added description column to activity_logs table');

  } catch (error) {
    console.error('Error running migration:', error);
  }
}

runMigration();