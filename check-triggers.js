const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTriggers() {
  console.log('🔍 Checking database triggers...');

  try {
    // Check triggers
    const { data: triggers, error: triggerError } = await supabase.rpc('sql', {
      query: `
        SELECT trigger_name, event_manipulation, event_object_table
        FROM information_schema.triggers
        WHERE event_object_schema = 'public' OR event_object_schema = 'auth'
        ORDER BY event_object_table, trigger_name;
      `
    });

    if (triggerError) {
      console.error('❌ Error checking triggers:', triggerError);
    } else {
      console.log('📋 Database triggers:', triggers);
    }

    // Check if users table exists and its structure
    const { data: userTable, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (userError) {
      console.error('❌ Error accessing users table:', userError);
    } else {
      console.log('✅ Users table accessible');
    }

    // Check auth.users table access
    const { data: authUsers, error: authError } = await supabase.rpc('sql', {
      query: 'SELECT count(*) as count FROM auth.users;'
    });

    if (authError) {
      console.error('❌ Error accessing auth.users:', authError);
    } else {
      console.log('✅ Auth users count:', authUsers);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTriggers();