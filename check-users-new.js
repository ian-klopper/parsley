const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key
const supabase = createClient(
  'https://drwytmbsonrfbzxpjkzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao'
);

async function checkUsers() {
  try {
    console.log('Checking users in database...');

    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError) {
      console.error('Error fetching users:', usersError);
    } else {
      console.log(`Found ${users?.length || 0} users in database:`);
      users?.forEach(user => {
        console.log(`- ID: ${user.id}, Auth ID: ${user.auth_id}, Email: ${user.email}, Role: ${user.role}`);
      });
    }

    // Check auth.users (Supabase Auth table)
    console.log('\nChecking auth.users table...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
    } else {
      console.log(`Found ${authUsers?.users?.length || 0} auth users:`);
      authUsers?.users?.forEach(user => {
        console.log(`- Auth ID: ${user.id}, Email: ${user.email}, Created: ${user.created_at}`);
      });
    }

  } catch (err) {
    console.error('Script error:', err);
  }
}

checkUsers().then(() => {
  console.log('Check completed');
  process.exit(0);
});