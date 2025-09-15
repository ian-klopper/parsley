import { NextRequest } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireNonPending(request);
    const supabase = await createSupabaseServer();

    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        collaborators,
        created_by,
        owner_id
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      throw error;
    }

    // Get collaborator user details
    if (job.collaborators && job.collaborators.length > 0) {
      const { data: collaboratorUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name, initials')
        .in('id', job.collaborators);

      if (usersError) {
        throw usersError;
      }

      return Response.json({
        data: {
          job_id: params.id,
          collaborators: collaboratorUsers
        }
      });
    }

    return Response.json({
      data: {
        job_id: params.id,
        collaborators: []
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireNonPending(request);
    const { email } = await request.json();

    const supabase = await createSupabaseServer();

    // Verify job exists and user has permission to manage collaborators
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, created_by, owner_id, collaborators')
      .eq('id', params.id)
      .single();

    if (jobError) {
      if (jobError.code === 'PGRST116') {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      throw jobError;
    }

    // Check if user can manage collaborators (owner, creator, or admin)
    if (user.role !== 'admin' && user.id !== job.created_by && user.id !== job.owner_id) {
      return Response.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Find the user to add as collaborator
    const { data: collaboratorUser, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, initials, role')
      .eq('email', email)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }
      throw userError;
    }

    // Don't allow pending users as collaborators
    if (collaboratorUser.role === 'pending') {
      return Response.json({ error: 'Cannot add pending users as collaborators' }, { status: 400 });
    }

    // Check if user is already a collaborator
    if (job.collaborators && job.collaborators.includes(collaboratorUser.id)) {
      return Response.json({ error: 'User is already a collaborator' }, { status: 400 });
    }

    // Add collaborator to the job
    const newCollaborators = [...(job.collaborators || []), collaboratorUser.id];

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        collaborators: newCollaborators,
        last_activity: new Date().toISOString()
      })
      .eq('id', params.id)
      .select('id, venue, job_id, collaborators')
      .single();

    if (updateError) {
      throw updateError;
    }

    return Response.json({
      data: {
        job_id: params.id,
        added_collaborator: {
          id: collaboratorUser.id,
          email: collaboratorUser.email,
          full_name: collaboratorUser.full_name,
          initials: collaboratorUser.initials
        },
        total_collaborators: newCollaborators.length
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireNonPending(request);
    const { searchParams } = new URL(request.url);
    const collaboratorId = searchParams.get('collaborator_id');

    if (!collaboratorId) {
      return Response.json({ error: 'collaborator_id parameter required' }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    // Verify job exists and user has permission to manage collaborators
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, created_by, owner_id, collaborators')
      .eq('id', params.id)
      .single();

    if (jobError) {
      if (jobError.code === 'PGRST116') {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      throw jobError;
    }

    // Check if user can manage collaborators (owner, creator, or admin)
    if (user.role !== 'admin' && user.id !== job.created_by && user.id !== job.owner_id) {
      return Response.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Check if the collaborator is actually in the list
    if (!job.collaborators || !job.collaborators.includes(collaboratorId)) {
      return Response.json({ error: 'User is not a collaborator' }, { status: 400 });
    }

    // Remove collaborator from the job
    const newCollaborators = job.collaborators.filter(id => id !== collaboratorId);

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        collaborators: newCollaborators,
        last_activity: new Date().toISOString()
      })
      .eq('id', params.id);

    if (updateError) {
      throw updateError;
    }

    return Response.json({
      data: {
        job_id: params.id,
        removed_collaborator_id: collaboratorId,
        total_collaborators: newCollaborators.length
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}