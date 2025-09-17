import { NextRequest } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';
import { ActivityLogger } from '@/lib/services/activity-logger';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireNonPending(request);
    const body = await request.json();
    const { newOwnerId } = body;
    
    if (!newOwnerId) {
      return Response.json(
        { error: 'newOwnerId is required' },
        { status: 400 }
      );
    }
    
    const supabase = await createSupabaseServer();
    
    // Get job details before transfer for logging
    const { data: existingJob, error: getError } = await supabase
      .from('jobs')
      .select('owner_id, venue, job_id, owner:owner_id(id, email, full_name)')
      .eq('id', params.id)
      .single();

    if (getError) {
      if (getError.code === 'PGRST116') {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      throw getError;
    }

    // Get new owner details for logging
    const { data: newOwner, error: newOwnerError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', newOwnerId)
      .single();

    if (newOwnerError || !newOwner) {
      return Response.json({ error: 'New owner not found' }, { status: 404 });
    }

    // Use the database function for ownership transfer
    const { error } = await supabase.rpc('transfer_job_ownership', {
      p_job_id: params.id,
      p_new_owner_id: newOwnerId,
      p_current_user_id: user.id
    });

    if (error) {
      if (error.message.includes('Cannot transfer ownership to pending user')) {
        return Response.json(
          { error: 'Cannot transfer ownership to pending user' },
          { status: 400 }
        );
      }
      if (error.message.includes('Only job owner or admin can transfer ownership')) {
        return Response.json(
          { error: 'Only job owner or admin can transfer ownership' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Log ownership transfer with comprehensive details
    await ActivityLogger.logJobActivity(
      user.id,
      'job.ownership_transferred',
      params.id,
      {
        previous_owner_id: existingJob.owner_id,
        previous_owner_name: existingJob.owner?.full_name || existingJob.owner?.email || 'Unknown Previous Owner',
        previous_owner_email: existingJob.owner?.email,
        new_owner_id: newOwner.id,
        new_owner_name: newOwner.full_name || newOwner.email,
        new_owner_email: newOwner.email,
        user_name: user.full_name || user.email,
        job_venue: existingJob.venue,
        job_number: existingJob.job_id,
        transfered_by: user.full_name || user.email,
        transfer_timestamp: new Date().toISOString()
      }
    );
    
    // Return updated job
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select(`
        *,
        creator:created_by(id, email, full_name),
        owner:owner_id(id, email, full_name),
        collaborator_users:collaborators(id, email, full_name, initials, color_index)
      `)
      .eq('id', params.id)
      .single();
      
    if (fetchError) {
      throw fetchError;
    }
    
    return Response.json({ 
      data: job,
      message: 'Ownership transferred successfully'
    });
    
  } catch (error) {
    return handleApiError(error);
  }
}