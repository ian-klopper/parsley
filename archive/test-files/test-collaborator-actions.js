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

async function testCollaboratorActions() {
  try {
    console.log('Testing collaborator actions and activity logging...\n');

    // Get job 123
    const { data: job } = await supabase
      .from('jobs')
      .select('id, job_id, venue, owner_id')
      .eq('job_id', '123')
      .single();

    if (!job) {
      console.error('Job 123 not found');
      return;
    }

    // Get Beau Dawson's user ID
    const { data: beau } = await supabase
      .from('users')
      .select('id, email, full_name')
      .ilike('full_name', '%beau%')
      .single();

    if (!beau) {
      console.log('Beau user not found');
      return;
    }

    console.log(`Found Beau: ${beau.full_name} (${beau.email})`);

    // Simulate removing Beau as collaborator
    console.log('\nSimulating removal of Beau from collaborators...');

    const { error: removeError } = await supabase
      .from('job_collaborators')
      .delete()
      .eq('job_id', job.id)
      .eq('user_id', beau.id);

    if (!removeError) {
      console.log('✓ Removed Beau from collaborators');

      // Log the activity manually (simulating what the API would do)
      await supabase
        .from('activity_logs')
        .insert({
          user_id: job.owner_id,
          action: 'job.collaborator_removed',
          status: 'success',
          details: {
            job_id: job.id,
            collaborator_id: beau.id,
            collaborator_name: beau.full_name || beau.email,
            removed_by_name: 'Ian Klopper',
            job_venue: job.venue,
            job_number: job.job_id
          },
          description: `Ian Klopper removed ${beau.full_name || beau.email} from job ${job.job_id}`,
          created_at: new Date().toISOString()
        });

      console.log('✓ Activity logged');
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Add Beau back
    console.log('\nAdding Beau back as collaborator...');

    const { error: addError } = await supabase
      .from('job_collaborators')
      .insert({
        job_id: job.id,
        user_id: beau.id,
        added_by: job.owner_id
      });

    if (!addError) {
      console.log('✓ Added Beau back as collaborator');

      // Log the activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: job.owner_id,
          action: 'job.collaborator_added',
          status: 'success',
          details: {
            job_id: job.id,
            collaborator_id: beau.id,
            collaborator_name: beau.full_name || beau.email,
            added_by_name: 'Ian Klopper',
            job_venue: job.venue,
            job_number: job.job_id
          },
          description: `Ian Klopper added ${beau.full_name || beau.email} to job ${job.job_id}`,
          created_at: new Date().toISOString()
        });

      console.log('✓ Activity logged');
    }

    // Check activity logs
    console.log('\nChecking activity logs with descriptions:');
    console.log('------------------------------------------');

    const { data: logs } = await supabase
      .from('activity_logs')
      .select('*')
      .or(`details->job_id.eq.${job.id},details->job_number.eq.123`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (logs && logs.length > 0) {
      logs.forEach(log => {
        const date = new Date(log.created_at).toLocaleString();
        console.log(`\n[${date}]`);
        console.log(`  Action: ${log.action}`);
        if (log.description) {
          console.log(`  Description: ${log.description}`);
        } else {
          console.log(`  Details: ${JSON.stringify(log.details)}`);
        }
      });
    } else {
      console.log('No activity logs found');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testCollaboratorActions();