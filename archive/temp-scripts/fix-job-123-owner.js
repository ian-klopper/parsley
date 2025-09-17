const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixJob123() {
  try {
    console.log('Fixing job 123 to ensure owner is in collaborators...\n');

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_id, venue, owner_id')
      .eq('job_id', '123')
      .single();

    if (jobError || !job) {
      console.error('Error fetching job:', jobError?.message || 'Job not found');
      return;
    }

    console.log(`Found job: ${job.venue} (ID: ${job.job_id})`);
    console.log(`Owner ID: ${job.owner_id}`);

    // Check if owner is already a collaborator
    const { data: existingCollab } = await supabase
      .from('job_collaborators')
      .select('*')
      .eq('job_id', job.id)
      .eq('user_id', job.owner_id)
      .single();

    if (existingCollab) {
      console.log('✓ Owner is already a collaborator');
    } else {
      console.log('⚠️ Owner is NOT a collaborator - fixing...');

      // Add owner as collaborator
      const { error: insertError } = await supabase
        .from('job_collaborators')
        .insert({
          job_id: job.id,
          user_id: job.owner_id,
          added_by: job.owner_id
        });

      if (insertError) {
        console.error('Error adding owner as collaborator:', insertError);
      } else {
        console.log('✅ Successfully added owner as collaborator');
      }
    }

    // Verify the fix
    const { data: allCollaborators } = await supabase
      .from('job_collaborators')
      .select('user:user_id(id, email, full_name)')
      .eq('job_id', job.id);

    console.log('\nCurrent collaborators:');
    allCollaborators?.forEach(collab => {
      const isOwner = collab.user.id === job.owner_id;
      console.log(`  - ${collab.user.full_name || collab.user.email}${isOwner ? ' (OWNER)' : ''}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

fixJob123();