const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugColorUpdate() {
  console.log('Debugging color update issue...\n');

  // Get all users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*');

  if (usersError) {
    console.error('Error fetching users:', usersError);
    return;
  }

  console.log('Found users in database:');
  users.forEach(user => {
    console.log(`- ${user.email} (ID: ${user.id}, auth_id: ${user.auth_id}, color: ${user.color_index})`);
  });

  // Test updating color for first user
  if (users.length > 0) {
    const testUser = users[0];
    console.log(`\nTesting color update for ${testUser.email}...`);

    const newColor = (testUser.color_index || 0) + 1;

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ color_index: newColor })
      .eq('id', testUser.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update failed:', updateError);
      console.error('Error details:', JSON.stringify(updateError, null, 2));
    } else {
      console.log(`Successfully updated color from ${testUser.color_index} to ${updated.color_index}`);
    }
  }

  // Check table structure
  console.log('\nChecking users table structure...');
  const { data: tableInfo, error: tableError } = await supabase
    .rpc('get_table_columns', { table_name: 'users' })
    .select('*');

  if (!tableError && tableInfo) {
    console.log('Table columns:', tableInfo);
  }
}

debugColorUpdate().catch(console.error);