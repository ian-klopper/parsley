const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key
const supabase = createClient(
  'https://drwytmbsonrfbzxpjkzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao'
);

async function promoteToAdmin() {
  try {
    console.log('Promoting user to admin...');

    // Show current users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    console.log('Current users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.role})`);
    });

    // Promote first user to admin (usually the main account)
    const userToPromote = users[0];

    if (userToPromote) {
      console.log(`\nPromoting ${userToPromote.email} to admin...`);

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin', updated_at: new Date().toISOString() })
        .eq('id', userToPromote.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to promote user:', updateError);
      } else {
        console.log(`✓ ${updatedUser.email} is now an admin!`);
      }
    }

    console.log('\nPromotion completed!');

  } catch (err) {
    console.error('Script error:', err);
  }
}

promoteToAdmin().then(() => {
  console.log('Script completed');
  process.exit(0);
});