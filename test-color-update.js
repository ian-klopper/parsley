const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjEzMjIsImV4cCI6MjA3MzAzNzMyMn0.YLFfJpQijIekgTsS3HAW4Ph4pnUeKIP3TievrX6eFc0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testColorUpdate() {
  console.log('Testing color update...\n');

  // Sign in as test user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ian.klopper@gmail.com',
    password: 'password123' // You'll need to set this
  });

  if (authError) {
    console.error('Auth error:', authError);
    // Try getting current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('No session found. Please login first.');
      return;
    }
    console.log('Using existing session');
  } else {
    console.log('Signed in successfully');
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error getting user:', userError);
    return;
  }

  console.log('Auth user ID:', user.id);
  console.log('Email:', user.email);

  // Check if profile exists
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single();

  if (profileError) {
    console.error('Profile error:', profileError);
    if (profileError.code === 'PGRST116') {
      console.log('No profile found for this auth user');
    }
    return;
  }

  console.log('\nProfile found:');
  console.log('Profile ID:', profile.id);
  console.log('Email:', profile.email);
  console.log('Current color_index:', profile.color_index);

  // Try to update color
  const newColorIndex = 7;
  const { data: updatedProfile, error: updateError } = await supabase
    .from('users')
    .update({ color_index: newColorIndex })
    .eq('id', profile.id)
    .select()
    .single();

  if (updateError) {
    console.error('\nUpdate error:', updateError);
    return;
  }

  console.log('\nSuccessfully updated color_index to:', updatedProfile.color_index);
}

testColorUpdate().catch(console.error);