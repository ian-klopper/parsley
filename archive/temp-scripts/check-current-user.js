const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndCreateProfiles() {
  console.log('Checking auth users and their profiles...\n');

  // Get all auth users
  const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('Error fetching auth users:', authError);
    return;
  }

  console.log(`Found ${authUsers.length} auth users\n`);

  for (const authUser of authUsers) {
    console.log(`Auth User: ${authUser.email} (${authUser.id})`);

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      console.log(`  ❌ No profile found - Creating one...`);

      // Create profile
      const fullName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';
      const initials = fullName
        .split(' ')
        .filter(name => name.length > 0)
        .map(name => name.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2);

      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert({
          auth_id: authUser.id,
          email: authUser.email,
          full_name: fullName,
          initials: initials,
          role: 'admin', // Setting as admin for testing
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.log(`  ❌ Error creating profile:`, createError);
      } else {
        console.log(`  ✅ Profile created with ID: ${newProfile.id}`);
      }
    } else if (profile) {
      console.log(`  ✅ Profile exists with ID: ${profile.id}, role: ${profile.role}`);
    } else {
      console.log(`  ❌ Error checking profile:`, profileError);
    }
    console.log('');
  }
}

checkAndCreateProfiles().catch(console.error);