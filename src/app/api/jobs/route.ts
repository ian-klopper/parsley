import { NextRequest } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer, createSupabaseServiceRole } from '@/lib/api/auth-middleware';
import { ActivityLogger } from '@/lib/services/activity-logger';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user (but don't require profile to exist yet)
    const supabase = await createSupabaseServer();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Try to get user profile to check role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role, full_name')
      .eq('id', authUser.id)
      .single();

    // If no user profile exists, return empty jobs list (pending user)
    if (userError && userError.code === 'PGRST116') {
      return Response.json({ data: [] });
    }

    // If other error, throw it
    if (userError) {
      throw userError;
    }

    // Only allow non-pending users to see jobs
    if (user.role === 'pending') {
      return Response.json({ data: [] });
    }

    // Query jobs directly instead of using the broken RPC function
    let query = supabase
      .from('jobs')
      .select(`
        *,
        creator:created_by(id, email, full_name),
        owner:owner_id(id, email, full_name)
      `);

    // If not admin, filter to only jobs they have access to
    if (user.role !== 'admin') {
      query = query.or(`created_by.eq.${user.id},owner_id.eq.${user.id}`);
    }

    const { data: jobs, error } = await query.order('last_activity', { ascending: false });

    if (error) {
      throw error;
    }

    // Add collaborator users for each job
    const jobsWithCollaborators = await Promise.all(
      (jobs || []).map(async (job) => {
        // Get collaborator count
        const { count } = await supabase
          .from('job_collaborators')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id);

        // Get actual collaborator user details
        const { data: collaborators, error: collabError } = await supabase
          .from('job_collaborators')
          .select('user:user_id(id, email, full_name, initials, color_index)')
          .eq('job_id', job.id);

        if (collabError) {
          console.error('Error fetching collaborators for job', job.id, ':', collabError);
        }

        // Filter out any null users and log if any are found
        const validCollaborators = collaborators?.filter(c => c.user !== null) || [];
        if (collaborators && collaborators.length !== validCollaborators.length) {
          console.warn(`Job ${job.id} has ${collaborators.length - validCollaborators.length} collaborators with missing user data`);
        }

        return {
          ...job,
          collaborator_count: count || 0,
          collaborator_users: validCollaborators.map(c => c.user)
        };
      })
    );

    return Response.json({ data: jobsWithCollaborators });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireNonPending(request);
    const body = await request.json();

    const supabase = await createSupabaseServer();

    // Extract collaborators and owner_id from body
    const { collaborators, owner_id, ...jobData } = body;

    // Create job with owner_id (default to creator if not specified)
    const { data: job, error } = await supabase
      .from('jobs')
      .insert([{
        ...jobData,
        created_by: user.id,
        owner_id: owner_id || user.id,  // Use provided owner or default to creator
        status: jobData.status || 'draft',
        last_activity: new Date().toISOString()
      }])
      .select(`
        *,
        creator:created_by(id, email, full_name),
        owner:owner_id(id, email, full_name)
      `)
      .single();

    if (error) {
      // Handle specific database constraint errors
      if (error.code === '23505' && error.message.includes('job_id')) {
        return Response.json(
          { error: `Job ID "${jobData.job_id}" already exists. Please choose a different Job ID.` },
          { status: 400 }
        );
      }
      throw error;
    }

    // Prepare final collaborators list - ensure owner is always included
    const finalOwner = job.owner_id || user.id;
    let finalCollaborators = collaborators || [];

    // Make sure owner is in the collaborators list
    if (!finalCollaborators.includes(finalOwner)) {
      finalCollaborators = [...finalCollaborators, finalOwner];
    }

    // If still no collaborators, add the creating user
    if (finalCollaborators.length === 0) {
      finalCollaborators = [user.id];
    }

    // Validate that all collaborators exist in the database
    const { data: validUsers, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .in('id', finalCollaborators);

    if (userCheckError) {
      console.error('Error checking users:', userCheckError);
    }

    const validUserIds = validUsers?.map(u => u.id) || [];
    const invalidUserIds = finalCollaborators.filter(id => !validUserIds.includes(id));

    if (invalidUserIds.length > 0) {
      console.warn(`Invalid user IDs detected: ${invalidUserIds.join(', ')}`);
      // Filter out invalid users
      finalCollaborators = finalCollaborators.filter(id => validUserIds.includes(id));
    }

    // Ensure at least the creating user is a collaborator
    if (finalCollaborators.length === 0) {
      console.warn('No valid collaborators found, adding creating user');
      finalCollaborators = [user.id];
    }

    // Log job creation with correct collaborator count
    await ActivityLogger.logJobActivity(
      user.id,
      'job.created',
      job.id,
      {
        venue: job.venue,
        job_id: job.job_id,
        owner_id: job.owner_id,
        collaborator_count: finalCollaborators.length
      }
    );

    // Add collaborators using service role to bypass RLS
    if (finalCollaborators.length > 0) {
      const collaboratorInserts = finalCollaborators.map((userId: string) => ({
        job_id: job.id,
        user_id: userId,
        added_by: user.id
      }));

      console.log('Adding collaborators to job:', {
        jobId: job.id,
        collaborators: finalCollaborators,
        inserts: collaboratorInserts
      });

      // Use service role client to bypass RLS policies
      const serviceSupabase = createSupabaseServiceRole();
      const { error: collabError, data: insertedCollabs } = await serviceSupabase
        .from('job_collaborators')
        .insert(collaboratorInserts)
        .select();

      if (collabError) {
        // Check if it's just a duplicate key error (which is expected if user is already a collaborator)
        if (collabError.code === '23505' && collabError.message.includes('job_collaborators_pkey')) {
          console.log('ℹ️ Some collaborators already exist (duplicate key), this is expected');
        } else {
          console.error('❌ Error adding collaborators:', {
            error: collabError,
            jobId: job.id,
            collaborators: finalCollaborators,
            errorCode: collabError.code,
            errorMessage: collabError.message,
            errorDetails: collabError.details
          });

          // Still don't fail the whole request if collaborators fail
          // But log more details for debugging
          await ActivityLogger.log(
            user.id,
            'job.collaborator_add_failed',
            'failure',
            {
              job_id: job.id,
              error_code: collabError.code,
              error_message: collabError.message,
              attempted_collaborators: finalCollaborators
            }
          );
        }
      } else {
        console.log('✅ Successfully added collaborators:', {
          jobId: job.id,
          addedCount: insertedCollabs?.length || 0,
          collaborators: insertedCollabs
        });

        // Log collaborator additions
        for (const userId of finalCollaborators) {
          await ActivityLogger.log(
            user.id,
            'job.collaborator_added',
            'success',
            {
              job_id: job.id,
              collaborator_id: userId
            }
          );
        }
      }
    }

    return Response.json({ data: job }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}