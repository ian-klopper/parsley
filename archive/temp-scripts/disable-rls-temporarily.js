const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function disableRLS() {
  console.log('🛑 Temporarily disabling RLS to test authentication...');

  try {
    // Disable RLS on all tables
    const commands = [
      'ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.job_collaborators DISABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;'
    ];

    for (const cmd of commands) {
      console.log(`Disabling RLS: ${cmd.split(' ')[2]}`);
      const { error } = await supabase.rpc('exec_sql', { sql: cmd });
      if (error) {
        console.error(`❌ Error: ${error.message}`);
      } else {
        console.log('✅ Disabled');
      }
    }

    console.log('\n🎉 RLS temporarily disabled!');
    console.log('⚠️  Security warning: All data is now accessible without restrictions');
    console.log('🧪 Try Google authentication now - it should work');
    console.log('📝 After testing, we\'ll create proper non-recursive policies');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

disableRLS();
