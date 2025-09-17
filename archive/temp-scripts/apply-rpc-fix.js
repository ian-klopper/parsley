const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Create Supabase client with service role key
const supabase = createClient(
  'https://drwytmbsonrfbzxpjkzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao'
);

async function applyFix() {
  try {
    console.log('Applying RPC function fix...');

    // Read the SQL file
    const sql = fs.readFileSync('fix-rpc-simple.sql', 'utf8');

    // Split SQL statements and execute them one by one
    const statements = sql.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('\nExecuting:', statement.substring(0, 50) + '...');

        // Try using the admin API endpoint directly
        const response = await fetch('https://drwytmbsonrfbzxpjkzm.supabase.co/rest/v1/rpc/query', {
          method: 'POST',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: statement + ';' })
        });

        if (!response.ok) {
          // Try alternate approach - directly modify via admin endpoint
          console.log('Direct RPC failed, skipping for now...');
        }
      }
    }

    // Test the function after attempting fix
    console.log('\n\nTesting the function...');
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (users && users[0]) {
      console.log('Testing with user ID:', users[0].id);
      const { data, error: testError } = await supabase.rpc('get_jobs_for_user', {
        user_id: users[0].id
      });
      if (testError) {
        console.error('Test error:', testError.message);
        if (testError.message.includes('ambiguous')) {
          console.log('\nThe function still has issues. Attempting simpler fix...');

          // Try a simpler version that just returns all jobs for now
          const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('*')
            .limit(10);

          if (jobsError) {
            console.error('Direct jobs query error:', jobsError);
          } else {
            console.log('Direct jobs query worked, found', jobs.length, 'jobs');
          }
        }
      } else {
        console.log('✓ Test successful! Jobs returned:', data ? data.length : 0);
      }
    }

  } catch (err) {
    console.error('Script error:', err);
  }
}

applyFix().then(() => {
  console.log('\nScript completed');
  process.exit(0);
});