const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key
const supabase = createClient(
  'https://drwytmbsonrfbzxpjkzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao'
);

async function fixRPCFunction() {
  try {
    console.log('Fixing get_jobs_for_user RPC function...');

    // Drop and recreate the function with fixed column reference
    const { error } = await supabase.rpc('query', {
      query: `
        -- Drop existing function
        DROP FUNCTION IF EXISTS public.get_jobs_for_user(UUID);

        -- Recreate with fixed column reference
        CREATE OR REPLACE FUNCTION public.get_jobs_for_user(user_id UUID)
        RETURNS TABLE (
          id UUID,
          venue TEXT,
          job_id TEXT,
          status TEXT,
          created_by UUID,
          owner_id UUID,
          last_activity TIMESTAMPTZ,
          created_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ,
          collaborator_count BIGINT
        )
        SECURITY DEFINER
        SET search_path = public
        LANGUAGE plpgsql
        AS $$
        DECLARE
          user_role TEXT;
        BEGIN
          -- Get user role
          SELECT role INTO user_role FROM public.users WHERE public.users.id = get_jobs_for_user.user_id;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'User not found';
          END IF;

          -- Return jobs based on user role and permissions
          RETURN QUERY
          SELECT
            j.id,
            j.venue,
            j.job_id,
            j.status,
            j.created_by,
            j.owner_id,
            j.last_activity,
            j.created_at,
            j.updated_at,
            COALESCE(collab_count.count, 0) as collaborator_count
          FROM public.jobs j
          LEFT JOIN (
            SELECT jc.job_id, COUNT(*) as count
            FROM public.job_collaborators jc
            GROUP BY jc.job_id
          ) collab_count ON collab_count.job_id = j.id
          WHERE
            user_role = 'admin' OR
            j.created_by = get_jobs_for_user.user_id OR
            j.owner_id = get_jobs_for_user.user_id OR
            EXISTS (
              SELECT 1 FROM public.job_collaborators jc2
              WHERE jc2.job_id = j.id AND jc2.user_id = get_jobs_for_user.user_id
            )
          ORDER BY j.last_activity DESC;
        END;
        $$;

        -- Grant permissions
        GRANT EXECUTE ON FUNCTION public.get_jobs_for_user(UUID) TO authenticated;
      `
    });

    if (error) {
      // The query RPC doesn't exist, let's use raw SQL
      const { data, error: sqlError } = await supabase.sql`
        -- Drop existing function
        DROP FUNCTION IF EXISTS public.get_jobs_for_user(UUID);
      `;

      if (sqlError && !sqlError.message.includes('does not exist')) {
        console.error('Error dropping function:', sqlError);
      }

      // Now create the fixed function
      const { error: createError } = await supabase.sql`
        CREATE OR REPLACE FUNCTION public.get_jobs_for_user(user_id UUID)
        RETURNS TABLE (
          id UUID,
          venue TEXT,
          job_id TEXT,
          status TEXT,
          created_by UUID,
          owner_id UUID,
          last_activity TIMESTAMPTZ,
          created_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ,
          collaborator_count BIGINT
        )
        SECURITY DEFINER
        SET search_path = public
        LANGUAGE plpgsql
        AS $$
        DECLARE
          user_role TEXT;
        BEGIN
          -- Get user role
          SELECT role INTO user_role FROM public.users WHERE public.users.id = get_jobs_for_user.user_id;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'User not found';
          END IF;

          -- Return jobs based on user role and permissions
          RETURN QUERY
          SELECT
            j.id,
            j.venue,
            j.job_id,
            j.status,
            j.created_by,
            j.owner_id,
            j.last_activity,
            j.created_at,
            j.updated_at,
            COALESCE(collab_count.count, 0) as collaborator_count
          FROM public.jobs j
          LEFT JOIN (
            SELECT jc.job_id, COUNT(*) as count
            FROM public.job_collaborators jc
            GROUP BY jc.job_id
          ) collab_count ON collab_count.job_id = j.id
          WHERE
            user_role = 'admin' OR
            j.created_by = get_jobs_for_user.user_id OR
            j.owner_id = get_jobs_for_user.user_id OR
            EXISTS (
              SELECT 1 FROM public.job_collaborators jc2
              WHERE jc2.job_id = j.id AND jc2.user_id = get_jobs_for_user.user_id
            )
          ORDER BY j.last_activity DESC;
        END;
        $$;
      `;

      if (createError) {
        console.error('Error creating function:', createError);
        return;
      }

      // Grant permissions
      const { error: grantError } = await supabase.sql`
        GRANT EXECUTE ON FUNCTION public.get_jobs_for_user(UUID) TO authenticated;
      `;

      if (grantError) {
        console.error('Error granting permissions:', grantError);
      }
    }

    console.log('✓ RPC function fixed successfully!');

    // Test the function
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (users && users[0]) {
      console.log('\nTesting function with user ID:', users[0].id);
      const { data, error: testError } = await supabase.rpc('get_jobs_for_user', {
        user_id: users[0].id
      });
      if (testError) {
        console.error('Test failed:', testError);
      } else {
        console.log('✓ Test successful! Jobs returned:', data ? data.length : 0);
      }
    }

  } catch (err) {
    console.error('Script error:', err);
  }
}

fixRPCFunction().then(() => {
  console.log('Script completed');
  process.exit(0);
});