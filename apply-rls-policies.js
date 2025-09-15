const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRLSPolicies() {
  console.log('🔐 Applying Row Level Security policies...');

  const policies = [
    // Users policies
    {
      name: 'users_select_policy',
      sql: `CREATE POLICY "users_select_policy" ON public.users
        FOR SELECT
        USING (
          id = auth.uid() OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'user'))
        )`
    },
    {
      name: 'users_update_own_policy',
      sql: `CREATE POLICY "users_update_own_policy" ON public.users
        FOR UPDATE
        USING (id = auth.uid())`
    },
    {
      name: 'users_insert_policy',
      sql: `CREATE POLICY "users_insert_policy" ON public.users
        FOR INSERT
        WITH CHECK (
          id = auth.uid() OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )`
    },
    {
      name: 'users_admin_delete_policy',
      sql: `CREATE POLICY "users_admin_delete_policy" ON public.users
        FOR DELETE
        USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))`
    },

    // Jobs policies
    {
      name: 'jobs_access_policy',
      sql: `CREATE POLICY "jobs_access_policy" ON public.jobs
        FOR SELECT
        USING (
          created_by = auth.uid() OR
          owner_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.job_collaborators jc
            WHERE jc.job_id = jobs.id AND jc.user_id = auth.uid()
          ) OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )`
    },
    {
      name: 'jobs_create_policy',
      sql: `CREATE POLICY "jobs_create_policy" ON public.jobs
        FOR INSERT
        WITH CHECK (
          created_by = auth.uid() AND
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'user'))
        )`
    },
    {
      name: 'jobs_update_policy',
      sql: `CREATE POLICY "jobs_update_policy" ON public.jobs
        FOR UPDATE
        USING (
          created_by = auth.uid() OR
          owner_id = auth.uid() OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )`
    },
    {
      name: 'jobs_delete_policy',
      sql: `CREATE POLICY "jobs_delete_policy" ON public.jobs
        FOR DELETE
        USING (
          owner_id = auth.uid() OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )`
    },

    // Job collaborators policies
    {
      name: 'job_collaborators_select_policy',
      sql: `CREATE POLICY "job_collaborators_select_policy" ON public.job_collaborators
        FOR SELECT
        USING (
          user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_collaborators.job_id
            AND (j.created_by = auth.uid() OR j.owner_id = auth.uid())
          ) OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )`
    },
    {
      name: 'job_collaborators_insert_policy',
      sql: `CREATE POLICY "job_collaborators_insert_policy" ON public.job_collaborators
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_collaborators.job_id
            AND (j.created_by = auth.uid() OR j.owner_id = auth.uid())
          ) OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )`
    },
    {
      name: 'job_collaborators_delete_policy',
      sql: `CREATE POLICY "job_collaborators_delete_policy" ON public.job_collaborators
        FOR DELETE
        USING (
          user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_collaborators.job_id
            AND (j.created_by = auth.uid() OR j.owner_id = auth.uid())
          ) OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )`
    },

    // Activity logs policies
    {
      name: 'activity_logs_select_policy',
      sql: `CREATE POLICY "activity_logs_select_policy" ON public.activity_logs
        FOR SELECT
        USING (
          user_id = auth.uid() OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )`
    },
    {
      name: 'activity_logs_insert_policy',
      sql: `CREATE POLICY "activity_logs_insert_policy" ON public.activity_logs
        FOR INSERT
        WITH CHECK (
          user_id = auth.uid() OR
          EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        )`
    }
  ];

  for (const policy of policies) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });
      if (error) {
        console.log(`⚠️  ${policy.name}: ${error.message}`);
      } else {
        console.log(`✅ ${policy.name} created successfully`);
      }
    } catch (err) {
      console.error(`❌ Error creating ${policy.name}:`, err.message);
    }
  }

  console.log('🎉 RLS policies applied successfully!');
}

applyRLSPolicies();