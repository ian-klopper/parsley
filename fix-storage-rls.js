#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load environment variables
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function setupStorageRLS() {
  console.log('🔧 Setting up storage RLS policies for extraction-results bucket...');

  try {
    // Create bucket if it doesn't exist
    const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
    
    if (bucketListError) {
      console.error('Error listing buckets:', bucketListError);
      return;
    }

    const extractionBucket = buckets.find(b => b.name === 'extraction-results');
    
    if (!extractionBucket) {
      console.log('📦 Creating extraction-results bucket...');
      const { data, error } = await supabase.storage.createBucket('extraction-results', {
        public: false,
        allowedMimeTypes: ['application/json']
      });
      
      if (error) {
        console.error('Error creating bucket:', error);
        return;
      }
      console.log('✅ Created extraction-results bucket');
    } else {
      console.log('✅ extraction-results bucket already exists');
    }

    // Instead of manually creating RLS policies (which requires superuser),
    // let's just test if we can upload with the service role key
    console.log('🧪 Testing storage upload with service role...');
    
    const testData = JSON.stringify({ test: 'data', timestamp: new Date().toISOString() });
    const testBlob = new Blob([testData], { type: 'application/json' });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('extraction-results')
      .upload(`test/test-${Date.now()}.json`, testBlob, {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Storage upload test failed:', uploadError);
      console.log('');
      console.log('📋 Manual Steps Required:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to Storage > extraction-results bucket');
      console.log('3. Go to Policies tab');
      console.log('4. Add the following policies:');
      console.log('');
      console.log('Policy 1: Allow service role to insert');
      console.log('  Name: service_role_insert');
      console.log('  Operation: INSERT');
      console.log('  Target: objects');
      console.log('  SQL: (auth.role() = \'service_role\')');
      console.log('');
      console.log('Policy 2: Allow service role to update');
      console.log('  Name: service_role_update'); 
      console.log('  Operation: UPDATE');
      console.log('  Target: objects');
      console.log('  SQL: (auth.role() = \'service_role\')');
      console.log('');
      console.log('Policy 3: Allow authenticated users to select');
      console.log('  Name: authenticated_select');
      console.log('  Operation: SELECT');
      console.log('  Target: objects');
      console.log('  SQL: (auth.role() = \'authenticated\')');
    } else {
      console.log('✅ Storage upload test successful!');
      console.log('Upload path:', uploadData.path);
      
      // Clean up test file
      await supabase.storage
        .from('extraction-results')
        .remove([uploadData.path]);
      console.log('🧹 Cleaned up test file');
    }

  } catch (error) {
    console.error('❌ Error setting up storage RLS:', error);
  }
}

setupStorageRLS();