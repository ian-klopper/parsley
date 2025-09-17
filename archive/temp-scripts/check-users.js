const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  try {
    console.log('=== CHECKING USERS TABLE ===');

    // Try to select from users table to see what columns exist
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Users table error:', error);
    } else {
      console.log('Users table exists. Sample data structure:');
      if (users && users.length > 0) {
        console.log('Columns found:', Object.keys(users[0]));
        console.log('Sample row:', users[0]);
      } else {
        console.log('Table exists but no data');
      }
    }

    // Try jobs table too
    console.log('\n=== CHECKING JOBS TABLE ===');
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .limit(1);

    if (jobsError) {
      console.error('Jobs table error:', jobsError);
    } else {
      console.log('Jobs table exists. Sample data structure:');
      if (jobs && jobs.length > 0) {
        console.log('Columns found:', Object.keys(jobs[0]));
        console.log('Sample row:', jobs[0]);
      } else {
        console.log('Table exists but no data');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();