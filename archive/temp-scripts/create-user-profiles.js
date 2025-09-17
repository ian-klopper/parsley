const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key
const supabase = createClient(
  'https://drwytmbsonrfbzxpjkzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao'
);

async function createUserProfiles() {
  try {
    console.log('Creating missing user profiles...');

    // Get auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }

    console.log(`Found ${authUsers?.users?.length || 0} auth users`);

    for (const authUser of authUsers.users) {
      console.log(`\nProcessing user: ${authUser.email}`);

      // Check if profile already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();

      if (existingUser) {
        console.log(`Profile already exists for ${authUser.email}`);
        continue;
      }

      // Create user profile
      const userProfile = {
        auth_id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
        role: 'pending', // Start as pending
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log(`Creating profile for ${authUser.email}...`);

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([userProfile])
        .select()
        .single();

      if (insertError) {
        console.error(`Failed to create profile for ${authUser.email}:`, insertError);
      } else {
        console.log(`✓ Created profile for ${authUser.email} with role: ${newUser.role}`);
      }
    }

    console.log('\nUser profile creation completed!');

  } catch (err) {
    console.error('Script error:', err);
  }
}

createUserProfiles().then(() => {
  console.log('Script completed');
  process.exit(0);
});