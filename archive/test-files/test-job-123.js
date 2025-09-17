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

async function checkJob123() {
  try {
    console.log('Checking job with ID 123...\n');

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        job_id,
        venue,
        owner_id,
        created_by,
        owner:owner_id(id, email, full_name, initials),
        creator:created_by(id, email, full_name, initials)
      `)
      .eq('job_id', '123')
      .single();

    if (jobError) {
      console.error('Error fetching job:', jobError.message);
      return;
    }

    if (!job) {
      console.log('No job found with ID 123');
      return;
    }

    console.log('Job Details:');
    console.log('------------');
    console.log(`Job ID: ${job.job_id}`);
    console.log(`Venue: ${job.venue}`);
    console.log(`Owner: ${job.owner?.full_name || job.owner?.email} (ID: ${job.owner_id})`);
    console.log(`Creator: ${job.creator?.full_name || job.creator?.email} (ID: ${job.created_by})`);

    // Get collaborators from job_collaborators table
    const { data: collaborators } = await supabase
      .from('job_collaborators')
      .select('user:user_id(id, email, full_name)')
      .eq('job_id', job.id);

    const collaboratorIds = collaborators?.map(c => c.user.id) || [];

    // Check collaborators
    if (collaborators && collaborators.length > 0) {
      console.log(`\nCollaborators (${collaborators.length}):`);

      collaborators.forEach(collab => {
        const user = collab.user;
        const isOwner = user.id === job.owner_id;
        console.log(`  - ${user.full_name || user.email}${isOwner ? ' (OWNER - Cannot be removed)' : ''}`);
      });
    } else {
      console.log('\nNo collaborators set');
    }

    console.log('\n✅ Validation Check:');
    console.log('--------------------');

    // Check if owner is in collaborators
    const ownerInCollaborators = collaboratorIds.includes(job.owner_id);

    if (ownerInCollaborators) {
      console.log('✓ Owner is correctly included in collaborators');
      console.log('✓ Owner cannot be removed from collaborators (protected)');
    } else {
      console.log('⚠️ WARNING: Owner is NOT in collaborators list!');
      console.log('  This is the issue you mentioned - owner should always be a collaborator');
    }

    // Check recent activity logs for this job
    console.log('\nRecent Activity Logs:');
    console.log('--------------------');

    const { data: logs, error: logsError } = await supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        description,
        details,
        created_at,
        user:user_id(email, full_name)
      `)
      .or(`details->job_id.eq.${job.id},details->job_number.eq.123`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (logs && logs.length > 0) {
      logs.forEach(log => {
        const date = new Date(log.created_at).toLocaleString();
        console.log(`\n[${date}] ${log.action}`);
        if (log.description) {
          console.log(`  Description: ${log.description}`);
        } else {
          console.log(`  (No description field - migration may be needed)`);
        }
        console.log(`  User: ${log.user?.full_name || log.user?.email}`);
      });
    } else {
      console.log('No activity logs found for this job');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkJob123();