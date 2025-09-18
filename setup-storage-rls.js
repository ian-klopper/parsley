import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorageRLS() {
  console.log('Setting up RLS policies for extraction-results storage bucket...');

  try {
    // Enable RLS on storage.objects if not already enabled
    const { error: enableError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;'
    });

    if (enableError) {
      console.log('RLS may already be enabled:', enableError.message);
    }

    // Drop existing policies if they exist
    const policies = [
      'DROP POLICY IF EXISTS "Users can upload their own extraction results" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can view their own extraction results" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can update their own extraction results" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can delete their own extraction results" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can upload extraction results" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can view extraction results" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can update extraction results" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can delete extraction results" ON storage.objects;'
    ];

    for (const policy of policies) {
      await supabase.rpc('exec_sql', { sql: policy });
    }

    // Create new policies
    const newPolicies = [
      `CREATE POLICY "Users can upload extraction results" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = 'extraction-results' AND
          auth.role() = 'authenticated'
        );`,

      `CREATE POLICY "Users can view extraction results" ON storage.objects
        FOR SELECT USING (
          bucket_id = 'extraction-results' AND
          auth.role() = 'authenticated'
        );`,

      `CREATE POLICY "Users can update extraction results" ON storage.objects
        FOR UPDATE USING (
          bucket_id = 'extraction-results' AND
          auth.role() = 'authenticated'
        );`,

      `CREATE POLICY "Users can delete extraction results" ON storage.objects
        FOR DELETE USING (
          bucket_id = 'extraction-results' AND
          auth.role() = 'authenticated'
        );`
    ];

    for (const policy of newPolicies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error) {
        console.error('Error creating policy:', error);
      } else {
        console.log('✅ Policy created successfully');
      }
    }

    console.log('✅ Storage RLS policies setup complete!');

  } catch (error) {
    console.error('Error setting up storage RLS:', error);
  }
}

setupStorageRLS();