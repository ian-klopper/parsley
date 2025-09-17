const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjEzMjIsImV4cCI6MjA3MzAzNzMyMn0.YLFfJpQijIekgTsS3HAW4Ph4pnUeKIP3TievrX6eFc0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogsAPI() {
  console.log('Testing logs API endpoint...\n');

  try {
    // Simulate admin login first
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'ian.klopper@gmail.com',
      password: 'password123'
    });

    if (authError) {
      console.error('❌ Auth failed:', authError.message);
      return;
    }

    console.log('✅ Authenticated as:', authData.user.email);

    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/admin/logs', {
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ API Response:');
    console.log('- Total logs:', data.data?.length || 0);
    console.log('- Pagination:', data.pagination);

    if (data.data && data.data.length > 0) {
      console.log('\nSample logs:');
      data.data.slice(0, 3).forEach((log, index) => {
        console.log(`${index + 1}. ${log.action} by ${log.users?.full_name || 'Unknown'} at ${log.created_at}`);
        console.log(`   Details: ${JSON.stringify(log.details)}`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLogsAPI().catch(console.error);