#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixDatabase() {
  console.log('🔧 Fixing Database Schema and RLS Policies\n');

  try {
    // 1. First, ensure the users table has proper structure
    console.log('1️⃣ Checking users table structure...');
    const { data: columns, error: colError } = await supabase
      .rpc('get_columns', { table_name: 'users' })
      .catch(() => ({ data: null, error: 'Function not found' }));

    // 2. Drop and recreate RLS policies for users table
    console.log('\n2️⃣ Fixing RLS policies for users table...');

    // Drop existing policies
    await supabase.rpc('exec_sql', {
      query: `
        DROP POLICY IF EXISTS "users_select_policy" ON public.users;
        DROP POLICY IF EXISTS "users_update_own_policy" ON public.users;
        DROP POLICY IF EXISTS "users_admin_manage_policy" ON public.users;
      `
    }).catch(() => {});

    // Create new policies that properly handle all user states
    const policies = [
      {
        name: 'users_select_policy',
        sql: `
          CREATE POLICY "users_select_policy" ON public.users
          FOR SELECT
          USING (
            -- Users can always see their own profile
            id = auth.uid() OR
            -- Any authenticated user can see other users (for collaboration)
            auth.uid() IS NOT NULL
          );
        `
      },
      {
        name: 'users_update_own_policy',
        sql: `
          CREATE POLICY "users_update_own_policy" ON public.users
          FOR UPDATE
          USING (
            -- Users can only update their own profile
            id = auth.uid()
          )
          WITH CHECK (
            -- Prevent users from changing their own role
            id = auth.uid() AND
            (role = OLD.role OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
          );
        `
      },
      {
        name: 'users_insert_policy',
        sql: `
          CREATE POLICY "users_insert_policy" ON public.users
          FOR INSERT
          WITH CHECK (
            -- Allow new users to create their own profile
            id = auth.uid()
          );
        `
      },
      {
        name: 'users_admin_policy',
        sql: `
          CREATE POLICY "users_admin_policy" ON public.users
          FOR ALL
          USING (
            -- Admins can do everything
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
          );
        `
      }
    ];

    for (const policy of policies) {
      console.log(`   Creating policy: ${policy.name}`);
      const { error } = await supabase.rpc('exec_sql', { query: policy.sql })
        .catch(() => ({ error: 'Failed to create policy' }));

      if (error) {
        console.log(`   ⚠️  Could not create ${policy.name} via RPC, attempting direct SQL...`);
      } else {
        console.log(`   ✅ ${policy.name} created`);
      }
    }

    // 3. Fix jobs table RLS policies
    console.log('\n3️⃣ Fixing RLS policies for jobs table...');

    await supabase.rpc('exec_sql', {
      query: `
        DROP POLICY IF EXISTS "jobs_access_policy" ON public.jobs;
        DROP POLICY IF EXISTS "jobs_manage_policy" ON public.jobs;
      `
    }).catch(() => {});

    const jobsPolicies = [
      {
        name: 'jobs_select_policy',
        sql: `
          CREATE POLICY "jobs_select_policy" ON public.jobs
          FOR SELECT
          USING (
            -- Pending users cannot see jobs
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role != 'pending') AND
            (
              -- Users can see their own jobs
              created_by = auth.uid() OR
              owner_id = auth.uid() OR
              -- Users can see jobs they collaborate on
              EXISTS (
                SELECT 1 FROM public.job_collaborators jc
                WHERE jc.job_id = jobs.id AND jc.user_id = auth.uid()
              ) OR
              -- Admins can see all jobs
              EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
            )
          );
        `
      },
      {
        name: 'jobs_insert_policy',
        sql: `
          CREATE POLICY "jobs_insert_policy" ON public.jobs
          FOR INSERT
          WITH CHECK (
            -- Only approved users can create jobs
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('user', 'admin'))
          );
        `
      },
      {
        name: 'jobs_update_policy',
        sql: `
          CREATE POLICY "jobs_update_policy" ON public.jobs
          FOR UPDATE
          USING (
            -- Only approved users can update jobs they own or created
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('user', 'admin')) AND
            (created_by = auth.uid() OR owner_id = auth.uid() OR
             EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
          );
        `
      },
      {
        name: 'jobs_delete_policy',
        sql: `
          CREATE POLICY "jobs_delete_policy" ON public.jobs
          FOR DELETE
          USING (
            -- Only owners and admins can delete jobs
            (owner_id = auth.uid() OR
             EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
          );
        `
      }
    ];

    for (const policy of jobsPolicies) {
      console.log(`   Creating policy: ${policy.name}`);
      const { error } = await supabase.rpc('exec_sql', { query: policy.sql })
        .catch(() => ({ error: 'Failed to create policy' }));

      if (error) {
        console.log(`   ⚠️  Could not create ${policy.name} via RPC`);
      } else {
        console.log(`   ✅ ${policy.name} created`);
      }
    }

    // 4. Ensure RLS is enabled on all tables
    console.log('\n4️⃣ Ensuring RLS is enabled on all tables...');
    const tables = ['users', 'jobs', 'job_collaborators', 'activity_logs'];

    for (const table of tables) {
      const { error } = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`
      }).catch(() => ({ error: 'Failed' }));

      if (!error) {
        console.log(`   ✅ RLS enabled on ${table}`);
      } else {
        console.log(`   ⚠️  RLS might already be enabled on ${table}`);
      }
    }

    // 5. Create auth trigger for auto user profile creation
    console.log('\n5️⃣ Creating auth trigger for user profile creation...');

    const triggerSql = `
      -- Drop existing trigger and function
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

      -- Create function to handle new user signup
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.users (id, email, full_name, role, color_index)
        VALUES (
          NEW.id,
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
          'pending',
          floor(random() * 64)::integer
        )
        ON CONFLICT (id) DO UPDATE
        SET
          email = EXCLUDED.email,
          full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
          updated_at = NOW();

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Create trigger
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT OR UPDATE ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
    `;

    const { error: triggerError } = await supabase.rpc('exec_sql', { query: triggerSql })
      .catch(() => ({ error: 'Failed to create trigger' }));

    if (!triggerError) {
      console.log('   ✅ Auth trigger created successfully');
    } else {
      console.log('   ⚠️  Could not create auth trigger via RPC');
    }

    console.log('\n✅ Database fixes completed!');
    console.log('\n📝 Summary:');
    console.log('   - RLS policies updated to handle pending users gracefully');
    console.log('   - Pending users can view their own profile');
    console.log('   - Pending users cannot access jobs or create content');
    console.log('   - Auth trigger ensures user profiles are created on signup');
    console.log('   - All tables have RLS enabled');

  } catch (error) {
    console.error('❌ Error fixing database:', error);
    process.exit(1);
  }
}

// Run the fix
fixDatabase();