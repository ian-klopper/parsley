const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key
const supabase = createClient(
  'https://drwytmbsonrfbzxpjkzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao'
);

async function fixRecursion() {
  try {
    console.log('Fixing infinite recursion in RLS policies...');

    // Drop ALL existing policies on users table
    const dropCommands = [
      `DROP POLICY IF EXISTS "users_select_policy" ON public.users;`,
      `DROP POLICY IF EXISTS "users_update_own_policy" ON public.users;`,
      `DROP POLICY IF EXISTS "users_admin_insert_policy" ON public.users;`,
      `DROP POLICY IF EXISTS "users_admin_delete_policy" ON public.users;`
    ];

    for (const cmd of dropCommands) {
      console.log(`Dropping policy...`);
      const { error } = await supabase.rpc('exec_sql', { sql: cmd });
      if (error && !error.message.includes('does not exist')) {
        console.log(`Drop failed: ${error.message}`);
      }
    }

    console.log('All policies dropped. Creating simple non-recursive policies...');

    // Create very simple policies without recursion
    const createCommands = [
      // Allow all authenticated users to see user profiles (non-recursive)
      `CREATE POLICY "users_select_policy" ON public.users
        FOR SELECT
        TO authenticated
        USING (true);`,

      // Allow users to update their own record only
      `CREATE POLICY "users_update_own_policy" ON public.users
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);`,

      // Allow insert for service role and new user creation
      `CREATE POLICY "users_admin_insert_policy" ON public.users
        FOR INSERT
        TO authenticated, service_role
        WITH CHECK (true);`,

      // Only service role can delete (no recursion)
      `CREATE POLICY "users_admin_delete_policy" ON public.users
        FOR DELETE
        USING (current_setting('role') = 'service_role');`
    ];

    for (const cmd of createCommands) {
      console.log(`Creating policy...`);
      const { error } = await supabase.rpc('exec_sql', { sql: cmd });
      if (error) {
        console.error(`Failed to create policy: ${error.message}`);
      } else {
        console.log('Policy created successfully');
      }
    }

    console.log('\nRecursion fix completed!');

  } catch (err) {
    console.error('Script error:', err);
  }
}

fixRecursion().then(() => {
  console.log('Script completed');
  process.exit(0);
});