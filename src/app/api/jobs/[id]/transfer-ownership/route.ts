import { NextRequest } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireNonPending(request);
    const { new_owner_email } = await request.json();

    if (!new_owner_email) {
      return Response.json({ error: 'new_owner_email is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    // Find the new owner by email
    const { data: newOwner, error: ownerError } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('email', new_owner_email)
      .single();

    if (ownerError) {
      if (ownerError.code === 'PGRST116') {
        return Response.json({ error: 'User not found with that email' }, { status: 404 });
      }
      throw ownerError;
    }

    // Use the transfer_job_ownership RPC function
    const { error: transferError } = await supabase.rpc('transfer_job_ownership', {
      p_job_id: params.id,
      p_new_owner_id: newOwner.id,
      p_current_user_id: user.id
    });

    if (transferError) {
      if (transferError.message.includes('Permission denied')) {
        return Response.json({ error: transferError.message }, { status: 403 });
      }
      if (transferError.message.includes('Job not found')) {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
      if (transferError.message.includes('Cannot transfer ownership to pending users')) {
        return Response.json({ error: 'Cannot transfer ownership to pending users' }, { status: 400 });
      }
      throw transferError;
    }

    // Get updated job details
    const { data: updatedJob, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        venue,
        job_id,
        status,
        owner_id,
        created_by,
        collaborators,
        owner:owner_id(id, email, full_name, initials)
      `)
      .eq('id', params.id)
      .single();

    if (jobError) {
      throw jobError;
    }

    return Response.json({
      data: {
        job_id: params.id,
        previous_owner_id: user.id,
        new_owner: {
          id: newOwner.id,
          email: newOwner.email,
          full_name: newOwner.full_name
        },
        job: updatedJob
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}