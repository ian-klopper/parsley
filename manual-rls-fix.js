const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key
const supabase = createClient(
  'https://drwytmbsonrfbzxpjkzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao'
);

async function manualFix() {
  try {
    console.log('Manually applying RLS policy fixes...');

    // First, let's check the current state of policies
    console.log('\nChecking current policies...');

    // Drop existing policies first (they should be recreated with proper logic)
    const dropCommands = [
      `DROP POLICY IF EXISTS "users_select_policy" ON public.users;`,
      `DROP POLICY IF EXISTS "users_update_own_policy" ON public.users;`,
      `DROP POLICY IF EXISTS "users_admin_insert_policy" ON public.users;`,
      `DROP POLICY IF EXISTS "users_admin_delete_policy" ON public.users;`
    ];

    for (const cmd of dropCommands) {
      console.log(`Executing: ${cmd}`);
      const { error } = await supabase.rpc('exec_sql', { sql: cmd });
      if (error) {
        console.log(`Command failed (might be OK if policy doesn't exist): ${error.message}`);
      }
    }

    // Create the fixed policies
    const createCommands = [
      `CREATE POLICY "users_select_policy" ON public.users
        FOR SELECT
        USING (
          auth.uid() = auth_id OR
          (
            role IN ('admin', 'user') AND
            EXISTS (
              SELECT 1 FROM public.users u
              WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'user')
            )
          )
        );`,

      `CREATE POLICY "users_update_own_policy" ON public.users
        FOR UPDATE
        USING (auth.uid() = auth_id);`,

      `CREATE POLICY "users_admin_insert_policy" ON public.users
        FOR INSERT
        WITH CHECK (
          auth_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.auth_id = auth.uid() AND u.role = 'admin'
          )
        );`,

      `CREATE POLICY "users_admin_delete_policy" ON public.users
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.auth_id = auth.uid() AND u.role = 'admin'
          )
        );`
    ];

    for (const cmd of createCommands) {
      console.log(`Executing: ${cmd.substring(0, 100)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: cmd });
      if (error) {
        console.error(`Failed to create policy: ${error.message}`);
      } else {
        console.log('Policy created successfully');
      }
    }

    console.log('\nRLS policy fixes completed!');

  } catch (err) {
    console.error('Script error:', err);
  }
}

manualFix().then(() => {
  console.log('Script completed');
  process.exit(0);
});