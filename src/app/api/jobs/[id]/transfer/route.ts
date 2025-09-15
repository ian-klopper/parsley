import { NextRequest } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';
import { ActivityLogger } from '@/lib/services/activity-logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const user = await requireNonPending(request);
    const { newOwnerEmail } = await request.json();

    if (!newOwnerEmail) {
      return Response.json({ error: 'New owner email is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    // Get the existing job to check permissions
    const { data: existingJob, error: getError } = await supabase
      .from('jobs')
      .select('created_by, owner_id')
      .eq('id', jobId)
      .single();

    if (getError) {
      if (getError.code === 'PGRST116') {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      throw getError;
    }

    // Check permissions - only creator, current owner, or admin can transfer
    if (user.role !== 'admin' && existingJob.created_by !== user.id && existingJob.owner_id !== user.id) {
      return Response.json({ error: 'Insufficient permissions to transfer ownership' }, { status: 403 });
    }

    // Find the new owner by email
    const { data: newOwner, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', newOwnerEmail)
      .single();

    if (userError || !newOwner) {
      return Response.json({ error: 'User not found with that email' }, { status: 404 });
    }

    // Update the job owner
    const { data: job, error: updateError } = await supabase
      .from('jobs')
      .update({
        owner_id: newOwner.id,
        last_activity: new Date().toISOString()
      })
      .eq('id', jobId)
      .select(`
        *,
        creator:created_by(id, email, full_name),
        owner:owner_id(id, email, full_name)
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log ownership transfer
    await ActivityLogger.logJobActivity(
      user.id,
      'job.ownership_transferred',
      jobId,
      {
        previous_owner_id: existingJob.owner_id,
        new_owner_id: newOwner.id,
        new_owner_email: newOwnerEmail
      }
    );

    // Get collaborators for the updated job
    const { data: collaborators } = await supabase
      .from('job_collaborators')
      .select('user:user_id(id, email, full_name, initials, color_index)')
      .eq('job_id', jobId);

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