const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkActivityLogs() {
  console.log('Checking activity_logs table...\n');

  try {
    // Check if activity_logs table exists by trying to query it
    const { data: testQuery, error: testError } = await supabase
      .from('activity_logs')
      .select('id')
      .limit(1);

    if (testError && testError.code === '42P01') {
      console.log('❌ activity_logs table does not exist!');
      console.log('Creating activity_logs table...\n');

      // Create the table
      const { error: createError } = await supabase.rpc('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS activity_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            status TEXT DEFAULT 'success',
            details JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
          CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
          CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
        `
      });

      if (createError) {
        console.error('Error creating table:', createError);
        return;
      }

      console.log('✅ activity_logs table created!');
    } else {
      console.log('✅ activity_logs table exists');
    }

    // Check table structure
    console.log('\nChecking table structure...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'activity_logs')
      .order('ordinal_position');

    if (columnsError) {
      console.error('Error checking columns:', columnsError);
    } else {
      console.log('Table columns:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Check existing logs
    console.log('\nChecking existing activity logs...');
    const { data: logs, error: logsError } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (logsError) {
      console.error('Error fetching logs:', logsError);
    } else {
      console.log(`Found ${logs.length} activity logs`);
      if (logs.length > 0) {
        console.log('Recent logs:');
        logs.forEach(log => {
          console.log(`  - ${log.created_at}: ${log.action} by user ${log.user_id}`);
        });
      }
    }

    // Test inserting a log
    console.log('\nTesting log insertion...');
    const { data: testLog, error: insertError } = await supabase
      .from('activity_logs')
      .insert({
        user_id: 'caec1fa4-f326-42f1-9653-648e5d467c20', // Test user ID
        action: 'test.log_insertion',
        status: 'success',
        details: { test: true },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting test log:', insertError);
    } else {
      console.log('✅ Test log inserted successfully:', testLog.id);

      // Clean up test log
      await supabase
        .from('activity_logs')
        .delete()
        .eq('id', testLog.id);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkActivityLogs().catch(console.error);