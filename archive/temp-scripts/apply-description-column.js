const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file
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
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    // Since we can't run ALTER TABLE directly, we'll verify the column doesn't exist
    // by trying to insert with the description field
    const testLog = {
      user_id: '2dde9eee-6409-4288-b686-444d39f7eb4a', // Ian's ID
      action: 'test.migration',
      status: 'success',
      details: { test: true },
      description: 'Testing if description column exists',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('activity_logs')
      .insert(testLog);

    if (error && error.message.includes('column "description" of relation "activity_logs" does not exist')) {
      console.log('Description column does not exist.');
      console.log('\nPlease run this SQL in your Supabase SQL editor:');
      console.log('=====================================');
      console.log(`
ALTER TABLE activity_logs
ADD COLUMN description TEXT;

CREATE INDEX idx_activity_logs_description ON activity_logs(description);
`);
      console.log('=====================================');
    } else if (!error) {
      console.log('✓ Description column already exists or was successfully added');

      // Clean up test entry
      await supabase
        .from('activity_logs')
        .delete()
        .eq('action', 'test.migration');
    } else {
      console.error('Unexpected error:', error);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

applyMigration();