const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://drwytmbsonrfbzxpjkzm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyd3l0bWJzb25yZmJ6eHBqa3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ2MTMyMiwiZXhwIjoyMDczMDM3MzIyfQ.5V6SU3Vth6QdtyepM94FMFut-UQweH7-nyTpPpIk2ao';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixJobDocumentsRLS() {
  console.log('🔐 Fixing RLS policies for job_documents table...\n');

  try {
    // 1. First, check if job_documents table exists
    console.log('1️⃣ Checking if job_documents table exists...');
    const { data: tableExists, error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'job_documents'
        );
      `
    });

    if (tableError) {
      console.error('❌ Error checking table existence:', tableError);
      return;
    }

    console.log('   Table exists:', tableExists?.[0]?.exists);

    if (!tableExists?.[0]?.exists) {
      console.log('⚠️  job_documents table does not exist. Creating it...');
      
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.job_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
            file_name TEXT NOT NULL,
            storage_path TEXT NOT NULL UNIQUE,
            file_url TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL CHECK (file_size > 0),
            uploaded_by UUID REFERENCES public.users(id) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });

      if (createError) {
        console.error('❌ Error creating table:', createError);
        return;
      }
      console.log('✅ job_documents table created');
    }

    // 2. Enable RLS on job_documents
    console.log('\n2️⃣ Enabling RLS on job_documents table...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.job_documents ENABLE ROW LEVEL SECURITY;'
    });

    if (rlsError) {
      console.log('   ⚠️  RLS may already be enabled:', rlsError.message);
    } else {
      console.log('   ✅ RLS enabled on job_documents');
    }

    // 3. Drop existing policies if they exist
    console.log('\n3️⃣ Dropping existing policies...');
    const existingPolicies = [
      'job_documents_select_policy',
      'job_documents_insert_policy', 
      'job_documents_update_policy',
      'job_documents_delete_policy'
    ];

    for (const policy of existingPolicies) {
      await supabase.rpc('exec_sql', {
        sql: `DROP POLICY IF EXISTS "${policy}" ON public.job_documents;`
      });
    }
    console.log('   ✅ Existing policies dropped');

    // 4. Create new comprehensive RLS policies
    console.log('\n4️⃣ Creating new RLS policies for job_documents...');

    const policies = [
      {
        name: 'job_documents_select_policy',
        description: 'Users can view documents for jobs they have access to',
        sql: `
          CREATE POLICY "job_documents_select_policy" ON public.job_documents
          FOR SELECT
          USING (
            -- Admins can see all documents
            (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
            (
              -- Non-pending users can see documents for jobs they have access to
              (SELECT role FROM public.users WHERE id = auth.uid()) != 'pending' AND
              EXISTS (
                SELECT 1 FROM public.jobs j
                WHERE j.id = job_documents.job_id
                AND (
                  j.owner_id = auth.uid() OR
                  j.created_by = auth.uid() OR
                  EXISTS (
                    SELECT 1 FROM public.job_collaborators jc
                    WHERE jc.job_id = j.id AND jc.user_id = auth.uid()
                  )
                )
              )
            )
          );
        `
      },
      {
        name: 'job_documents_insert_policy',
        description: 'Users can upload documents to jobs they have access to',
        sql: `
          CREATE POLICY "job_documents_insert_policy" ON public.job_documents
          FOR INSERT
          WITH CHECK (
            -- Must be authenticated and not pending
            (SELECT role FROM public.users WHERE id = auth.uid()) != 'pending' AND
            uploaded_by = auth.uid() AND
            EXISTS (
              SELECT 1 FROM public.jobs j
              WHERE j.id = job_documents.job_id
              AND (
                j.owner_id = auth.uid() OR
                j.created_by = auth.uid() OR
                EXISTS (
                  SELECT 1 FROM public.job_collaborators jc
                  WHERE jc.job_id = j.id AND jc.user_id = auth.uid()
                ) OR
                (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
              )
            )
          );
        `
      },
      {
        name: 'job_documents_update_policy',
        description: 'Users can update documents they uploaded or admins can update any',
        sql: `
          CREATE POLICY "job_documents_update_policy" ON public.job_documents
          FOR UPDATE
          USING (
            -- Admins can update any document
            (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
            (
              -- Non-pending users can update documents they uploaded for jobs they have access to
              (SELECT role FROM public.users WHERE id = auth.uid()) != 'pending' AND
              uploaded_by = auth.uid() AND
              EXISTS (
                SELECT 1 FROM public.jobs j
                WHERE j.id = job_documents.job_id
                AND (
                  j.owner_id = auth.uid() OR
                  j.created_by = auth.uid() OR
                  EXISTS (
                    SELECT 1 FROM public.job_collaborators jc
                    WHERE jc.job_id = j.id AND jc.user_id = auth.uid()
                  )
                )
              )
            )
          );
        `
      },
      {
        name: 'job_documents_delete_policy',
        description: 'Users can delete documents they uploaded, job owners can delete any document in their job, admins can delete any',
        sql: `
          CREATE POLICY "job_documents_delete_policy" ON public.job_documents
          FOR DELETE
          USING (
            -- Admins can delete any document
            (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
            (
              -- Non-pending users can delete documents based on permissions
              (SELECT role FROM public.users WHERE id = auth.uid()) != 'pending' AND
              (
                -- User uploaded the document
                uploaded_by = auth.uid() OR
                -- User is the job owner
                EXISTS (
                  SELECT 1 FROM public.jobs j
                  WHERE j.id = job_documents.job_id
                  AND j.owner_id = auth.uid()
                )
              )
            )
          );
        `
      }
    ];

    for (const policy of policies) {
      console.log(`   Creating: ${policy.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });
      
      if (error) {
        console.error(`   ❌ Error creating ${policy.name}:`, error.message);
      } else {
        console.log(`   ✅ ${policy.name} created successfully`);
      }
    }

    // 5. Add to realtime publication if not already added
    console.log('\n5️⃣ Adding job_documents to realtime publication...');
    const { error: realtimeError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER PUBLICATION supabase_realtime ADD TABLE public.job_documents;'
    });

    if (realtimeError) {
      console.log('   ⚠️  Table may already be in realtime publication:', realtimeError.message);
    } else {
      console.log('   ✅ job_documents added to realtime publication');
    }

    // 6. Test the policies by trying to fetch some data
    console.log('\n6️⃣ Testing RLS policies...');
    try {
      const { data: testData, error: testError } = await supabase
        .from('job_documents')
        .select('id, file_name, created_at')
        .limit(1);

      if (testError) {
        console.log('   ⚠️  Test query failed (this might be expected if no documents exist):', testError.message);
      } else {
        console.log(`   ✅ Test query successful. Found ${testData?.length || 0} documents.`);
      }
    } catch (error) {
      console.log('   ⚠️  Test query error:', error.message);
    }

    console.log('\n🎉 job_documents RLS policies setup complete!');
    console.log('\nNext steps:');
    console.log('1. Test file upload functionality in the application');
    console.log('2. Check browser console for any remaining 403 errors');
    console.log('3. Verify that users can only see documents for jobs they have access to');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixJobDocumentsRLS();