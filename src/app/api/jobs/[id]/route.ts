import { NextRequest } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer, createSupabaseServiceRole } from '@/lib/api/auth-middleware';
import { ActivityLogger } from '@/lib/services/activity-logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    // Get authenticated user
    const supabase = await createSupabaseServer();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', authUser.id)
      .single();

    if (userError && userError.code === 'PGRST116') {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    if (userError) {
      throw userError;
    }

    if (user.role === 'pending') {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get the job with related data
    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        creator:created_by(id, email, full_name),
        owner:owner_id(id, email, full_name)
      `)
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      throw error;
    }

    // Get collaborators from job_collaborators table
    const { data: collaborators, error: collabError } = await supabase
      .from('job_collaborators')
      .select('user:user_id(id, email, full_name, initials, color_index)')
      .eq('job_id', jobId);

    if (collabError) {
      console.error('Error fetching collaborators:', collabError);
    }

    // Format the response with collaborators
    const jobWithCollaborators = {
      ...job,
      collaborators: collaborators?.map(c => c.user.id) || [],
      collaborator_users: collaborators?.map(c => c.user) || []
    };

    return Response.json({ data: jobWithCollaborators });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const user = await requireNonPending(request);
    const body = await request.json();

    const supabase = await createSupabaseServer();

    // Extract collaborators from body
    const { collaborators, ...jobData } = body;

    // Prevent updating owner_id and created_by through this endpoint
    delete jobData.owner_id;
    delete jobData.created_by;

    // Get the previous state before updating (for logging status changes)
    const { data: previousJob } = await supabase
      .from('jobs')
      .select('status, venue, job_id')
      .eq('id', jobId)
      .single();

    // Update the job
    const { data: job, error } = await supabase
      .from('jobs')
      .update({
        ...jobData,
        last_activity: new Date().toISOString()
      })
      .eq('id', jobId)
      .select(`
        *,
        creator:created_by(id, email, full_name),
        owner:owner_id(id, email, full_name)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      throw error;
    }

    // Log job update with proper details
    if (jobData.status && previousJob && previousJob.status !== jobData.status) {
      // Log status change specifically
      await ActivityLogger.logJobActivity(
        user.id,
        'job.status_changed',
        jobId,
        {
          old_status: previousJob.status,
          new_status: jobData.status,
          user_name: user.full_name || user.email,
          job_venue: job.venue,
          job_number: job.job_id
        }
      );
    } else {
      // Log general update
      await ActivityLogger.logJobActivity(
        user.id,
        'job.updated',
        jobId,
        {
          updated_fields: Object.keys(jobData),
          user_name: user.full_name || user.email,
          job_venue: job.venue,
          job_number: job.job_id
        }
      );
    }

    // Update collaborators if provided
    if (collaborators !== undefined) {
      // Get current collaborators before changes for detailed logging
      const { data: currentCollaborators } = await supabase
        .from('job_collaborators')
        .select('user:user_id(id, email, full_name)')
        .eq('job_id', jobId);

      const currentCollaboratorIds = currentCollaborators?.map(c => c.user.id) || [];
      const newCollaboratorIds = collaborators;

      // Determine who was added and removed
      const addedIds = newCollaboratorIds.filter(id => !currentCollaboratorIds.includes(id));
      const removedIds = currentCollaboratorIds.filter(id => !newCollaboratorIds.includes(id));

      // Get user details for added collaborators
      const addedUsers = addedIds.length > 0 ? await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', addedIds) : { data: [] };

      // Get user details for removed collaborators
      const removedUsers = removedIds.length > 0 ?
        currentCollaborators?.filter(c => removedIds.includes(c.user.id))?.map(c => c.user) || [] : [];

      // Use service role for collaborator operations to bypass RLS
      const serviceSupabase = createSupabaseServiceRole();

      // Remove existing collaborators
      const { error: deleteError } = await serviceSupabase
        .from('job_collaborators')
        .delete()
        .eq('job_id', jobId);

      if (deleteError) {
        console.error('Error removing collaborators:', deleteError);
      }

      // Add new collaborators
      if (collaborators.length > 0) {
        const collaboratorInserts = collaborators.map((userId: string) => ({
          job_id: jobId,
          user_id: userId,
          added_by: user.id
        }));

        const { error: insertError } = await serviceSupabase
          .from('job_collaborators')
          .insert(collaboratorInserts);

        if (insertError) {
          console.error('Error adding collaborators:', insertError);
        }
      }

      // Log detailed collaborator changes if any occurred
      if (addedIds.length > 0 || removedIds.length > 0) {
        await ActivityLogger.logJobActivity(
          user.id,
          'job.updated',
          jobId,
          {
            updated_fields: ['collaborators'],
            collaborator_changes: {
              added: addedUsers.data?.map(u => ({ id: u.id, name: u.full_name || u.email })) || [],
              removed: removedUsers.map(u => ({ id: u.id, name: u.full_name || u.email })),
              previous_count: currentCollaboratorIds.length,
              new_count: newCollaboratorIds.length
            },
            user_name: user.full_name || user.email,
            job_venue: job.venue,
            job_number: job.job_id
          }
        );
      }
    }

    // Get updated collaborators
    const { data: updatedCollaborators } = await supabase
      .from('job_collaborators')
      .select('user:user_id(id, email, full_name, initials, color_index)')
      .eq('job_id', jobId);

    const jobWithCollaborators = {
      ...job,
      collaborators: updatedCollaborators?.map(c => c.user.id) || [],
      collaborator_users: updatedCollaborators?.map(c => c.user) || []
    };

    return Response.json({ data: jobWithCollaborators });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const user = await requireNonPending(request);

    const supabase = await createSupabaseServer();

    // Check if the job exists and user has permission to delete
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('id, owner_id, venue, job_id')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if user is owner or admin
    if (user.role !== 'admin' && job.owner_id !== user.id) {
      return Response.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Delete the job
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      throw error;
    }

    // Log job deletion
    await ActivityLogger.logJobActivity(
      user.id,
      'job.deleted',
      jobId,
      {
        user_name: user.full_name || user.email,
        job_venue: job.venue,
        job_number: job.job_id
      }
    );

    return Response.json({ data: { success: true } });

  } catch (error) {
    return handleApiError(error);
  }
}