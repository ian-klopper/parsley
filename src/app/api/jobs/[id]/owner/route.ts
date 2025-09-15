import { NextRequest } from 'next/server';
import { requireNonPending, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';

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