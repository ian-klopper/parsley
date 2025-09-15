const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAuthManually() {
  console.log('🧪 Testing authentication manually...');

  try {
    // First, let's see what triggers exist on auth.users
    console.log('1. Checking existing triggers on auth.users...');
    const { data: triggers, error: triggerError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT trigger_name, action_statement, action_timing, event_manipulation
        FROM information_schema.triggers
        WHERE event_object_table = 'users' AND event_object_schema = 'auth';
      `
    });

    if (triggerError) {
      console.error('❌ Error checking triggers:', triggerError);
    } else {
      console.log('✅ Existing triggers on auth.users:', triggers);
    }

    // Check if our function exists
    console.log('\n2. Checking if our function exists...');
    const { data: functions, error: funcError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT routine_name, routine_definition
        FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'handle_new_user';
      `
    });

    if (funcError) {
      console.error('❌ Error checking function:', funcError);
    } else {
      console.log('✅ Our function exists:', functions?.length > 0 ? 'YES' : 'NO');
    }

    // Let's try to manually create a test user profile
    console.log('\n3. Testing manual user creation...');
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';
    const { data: testUser, error: testError } = await supabase
      .from('users')
      .insert([{
        id: testUserId,
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'pending',
        color_index: 0
      }])
      .select();

    if (testError) {
      console.error('❌ Error creating test user:', testError);
    } else {
      console.log('✅ Test user created successfully:', testUser);

      // Clean up
      await supabase.from('users').delete().eq('id', testUserId);
      console.log('🧹 Test user cleaned up');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testAuthManually();