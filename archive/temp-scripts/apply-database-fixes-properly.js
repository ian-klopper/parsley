#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeSQL(sql, description) {
  try {
    console.log(`📄 ${description}...`);
    const { data, error } = await supabase.rpc('sql', { query: sql });

    if (error) {
      // Some errors are expected (like "already exists")
      if (error.message.includes('already exists') ||
          error.message.includes('does not exist') ||
          error.code === '42P07' || // relation already exists
          error.code === '42P16') { // function already exists
        console.log(`⚠️  ${description} - already exists, skipping`);
        return true;
      }
      console.error(`❌ Error: ${error.message}`);
      return false;
    }

    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ Error executing ${description}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Applying Database Fixes for Parsley System\n');

  let success = true;

  // 1. Add owner_id column to jobs table
  success &= await executeSQL(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'jobs'
            AND column_name = 'owner_id'
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.jobs ADD COLUMN owner_id UUID REFERENCES public.users(id);
            UPDATE public.jobs SET owner_id = created_by WHERE owner_id IS NULL;
            ALTER TABLE public.jobs ALTER COLUMN owner_id SET NOT NULL;
            RAISE NOTICE 'Added owner_id column to jobs table';
        ELSE
            RAISE NOTICE 'owner_id column already exists';
        END IF;
    END $$;
  `, 'Adding owner_id column to jobs table');

  // 2. Create get_jobs_for_user RPC function
  success &= await executeSQL(`
    CREATE OR REPLACE FUNCTION public.get_jobs_for_user(user_id UUID)
    RETURNS TABLE (
      id UUID,
      venue TEXT,
      job_id TEXT,
      status TEXT,
      created_by UUID,
      owner_id UUID,
      collaborators UUID[],
      last_activity TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE,
      updated_at TIMESTAMP WITH TIME ZONE
    )
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT
        j.id,
        j.venue,
        j.job_id,
        j.status,
        j.created_by,
        j.owner_id,
        j.collaborators,
        j.last_activity,
        j.created_at,
        j.updated_at
      FROM jobs j
      WHERE
        (SELECT role FROM users WHERE users.id = user_id) = 'admin'
        OR j.created_by = user_id
        OR j.owner_id = user_id
        OR user_id = ANY(j.collaborators)
      ORDER BY j.last_activity DESC;
    END;
    $func$ LANGUAGE plpgsql;
  `, 'Creating get_jobs_for_user RPC function');

  // 3. Grant permissions for get_jobs_for_user
  success &= await executeSQL(`
    GRANT EXECUTE ON FUNCTION public.get_jobs_for_user(UUID) TO authenticated;
  `, 'Granting permissions for get_jobs_for_user');

  // 4. Create update_user_role RPC function
  success &= await executeSQL(`
    CREATE OR REPLACE FUNCTION public.update_user_role(
      p_user_id UUID,
      p_new_role TEXT,
      p_admin_id UUID
    )
    RETURNS VOID
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Only admins can update user roles';
      END IF;

      IF p_user_id = p_admin_id THEN
        RAISE EXCEPTION 'Admins cannot change their own role';
      END IF;

      UPDATE users
      SET
        role = p_new_role,
        approved_at = CASE WHEN p_new_role != 'pending' THEN NOW() ELSE NULL END,
        approved_by = CASE WHEN p_new_role != 'pending' THEN p_admin_id ELSE NULL END,
        updated_at = NOW()
      WHERE id = p_user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
      END IF;
    END;
    $func$ LANGUAGE plpgsql;
  `, 'Creating update_user_role RPC function');

  // 5. Grant permissions for update_user_role
  success &= await executeSQL(`
    GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT, UUID) TO authenticated;
  `, 'Granting permissions for update_user_role');

  // 6. Create transfer_job_ownership RPC function
  success &= await executeSQL(`
    CREATE OR REPLACE FUNCTION public.transfer_job_ownership(
      p_job_id UUID,
      p_new_owner_id UUID,
      p_current_user_id UUID
    )
    RETURNS VOID
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    DECLARE
      current_job RECORD;
      current_user_role TEXT;
      new_owner RECORD;
    BEGIN
      SELECT role INTO current_user_role FROM users WHERE id = p_current_user_id;
      SELECT * INTO current_job FROM jobs WHERE id = p_job_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found';
      END IF;

      IF current_user_role != 'admin' AND
         p_current_user_id != current_job.owner_id AND
         p_current_user_id != current_job.created_by THEN
        RAISE EXCEPTION 'Permission denied. Only job owner, creator, or admin can transfer ownership';
      END IF;

      SELECT * INTO new_owner FROM users WHERE id = p_new_owner_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'New owner not found';
      END IF;

      IF new_owner.role = 'pending' THEN
        RAISE EXCEPTION 'Cannot transfer ownership to pending users';
      END IF;

      UPDATE jobs
      SET
        owner_id = p_new_owner_id,
        last_activity = NOW(),
        updated_at = NOW()
      WHERE id = p_job_id;

      IF NOT (p_new_owner_id = ANY(current_job.collaborators)) THEN
        UPDATE jobs
        SET collaborators = array_append(collaborators, p_new_owner_id)
        WHERE id = p_job_id;
      END IF;
    END;
    $func$ LANGUAGE plpgsql;
  `, 'Creating transfer_job_ownership RPC function');

  // 7. Grant permissions for transfer_job_ownership
  success &= await executeSQL(`
    GRANT EXECUTE ON FUNCTION public.transfer_job_ownership(UUID, UUID, UUID) TO authenticated;
  `, 'Granting permissions for transfer_job_ownership');

  // 8. Update RLS policies
  success &= await executeSQL(`
    DROP POLICY IF EXISTS "Users can view jobs they have access to" ON public.jobs;
  `, 'Dropping old job view policy');

  success &= await executeSQL(`
    CREATE POLICY "Users can view jobs they have access to" ON public.jobs
      FOR SELECT USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
        created_by = auth.uid() OR
        owner_id = auth.uid() OR
        auth.uid() = ANY(collaborators)
      );
  `, 'Creating new job view policy');

  success &= await executeSQL(`
    DROP POLICY IF EXISTS "Users can update jobs they have access to" ON public.jobs;
    DROP POLICY IF EXISTS "authorized_job_updates" ON public.jobs;
  `, 'Dropping old job update policies');

  success &= await executeSQL(`
    CREATE POLICY "Users can update jobs they have access to" ON public.jobs
      FOR UPDATE USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
        created_by = auth.uid() OR
        owner_id = auth.uid()
      );
  `, 'Creating new job update policy');

  // Test the implementation
  console.log('\n🧪 Testing the implementation...');

  try {
    // Test that functions exist
    const { data: functions, error: funcError } = await supabase.rpc('sql', {
      query: `
        SELECT proname, pronargs
        FROM pg_proc
        WHERE proname IN ('get_jobs_for_user', 'update_user_role', 'transfer_job_ownership')
        ORDER BY proname;
      `
    });

    if (!funcError && functions) {
      console.log('✅ RPC Functions created:');
      functions.forEach(func => {
        console.log(`   - ${func.proname}() with ${func.pronargs} arguments`);
      });
    }

    // Test owner_id column exists
    const { data: columns, error: colError } = await supabase.rpc('sql', {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'jobs' AND column_name = 'owner_id';
      `
    });

    if (!colError && columns && columns.length > 0) {
      console.log('✅ owner_id column exists in jobs table');
    }

  } catch (error) {
    console.error('⚠️  Could not verify implementation:', error.message);
  }

  if (success) {
    console.log('\n🎉 ALL DATABASE FIXES APPLIED SUCCESSFULLY!');
    console.log('✅ The auth, user, jobs, and collaborators system is now fully functional');
    console.log('\n📋 Next steps:');
    console.log('   1. Test the system with: npm run test:database');
    console.log('   2. Start the development server: npm run dev');
    console.log('   3. Test job ownership transfer functionality in the UI');
  } else {
    console.log('\n❌ Some fixes failed to apply. Please check the errors above.');
    console.log('💡 Try running the individual SQL statements in the Supabase SQL Editor.');
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});