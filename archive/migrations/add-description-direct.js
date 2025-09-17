const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  console.error('URL:', supabaseUrl);
  console.error('Key:', supabaseKey ? 'Present' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addDescriptionColumn() {
  try {
    console.log('Running migration to add description column...');

    // First, check if column already exists
    const { data: columns, error: checkError } = await supabase
      .from('activity_logs')
      .select('*')
      .limit(1);

    if (!checkError) {
      console.log('Checking existing columns...');

      // Try to add the column using raw SQL through a stored procedure
      // Note: Supabase doesn't have a direct way to run ALTER TABLE
      // We'll use the SQL editor approach

      console.log('Note: Please run the following SQL in your Supabase SQL editor:');
      console.log(`
-- Add description column to activity_logs table
ALTER TABLE activity_logs
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create an index on the description column for better search performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_description ON activity_logs(description);
      `);

      console.log('\nAlternatively, the column may already exist or this migration needs to be run via Supabase dashboard.');
    } else {
      console.error('Error checking table:', checkError);
    }

  } catch (error) {
    console.error('Error running migration:', error);
  }
}

addDescriptionColumn();