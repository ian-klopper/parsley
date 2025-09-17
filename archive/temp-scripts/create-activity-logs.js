const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createActivityLogsTable() {
  console.log('Creating activity_logs table...\n');

  try {
    // Create the table using direct SQL
    const createTableSQL = `
      -- Create activity_logs table
      CREATE TABLE IF NOT EXISTS activity_logs (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          status TEXT DEFAULT 'success',
          details JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
    `;

    // Execute the SQL using the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ query: createTableSQL })
    });

    if (!response.ok) {
      console.error('HTTP Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    console.log('✅ Table creation attempt completed');

    // Test if table was created by trying to insert a test record
    console.log('Testing table...');

    const { data: testInsert, error: insertError } = await supabase
      .from('activity_logs')
      .insert({
        user_id: 'caec1fa4-f326-42f1-9653-648e5d467c20',
        action: 'test.table_creation',
        status: 'success',
        details: { test: true }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error testing table:', insertError);

      // Try alternative table creation method
      console.log('Trying alternative creation method...');

      const { error: altError } = await supabase
        .from('activity_logs')
        .select('*')
        .limit(0);

      if (altError && altError.message.includes('does not exist')) {
        console.log('Table definitely does not exist. Creating manually...');

        // Use a simpler creation approach
        const { data, error } = await supabase.rpc('create_activity_logs_table', {});

        if (error) {
          console.error('❌ RPC creation failed:', error);

          // Last resort: show what needs to be done manually
          console.log('\n❌ Could not create table automatically.');
          console.log('Please run this SQL in your Supabase SQL editor:');
          console.log('\n' + createTableSQL);

        } else {
          console.log('✅ Table created via RPC');
        }
      }
    } else {
      console.log('✅ Table exists and working! Test record:', testInsert.id);

      // Clean up test record
      await supabase
        .from('activity_logs')
        .delete()
        .eq('id', testInsert.id);

      console.log('Test record cleaned up.');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);

    console.log('\n📋 Manual SQL to run in Supabase dashboard:');
    console.log(`
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

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all activity logs" ON activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "System can insert activity logs" ON activity_logs
    FOR INSERT WITH CHECK (true);
    `);
  }
}

createActivityLogsTable().catch(console.error);