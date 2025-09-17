import { NextRequest } from 'next/server';
import { requireAdmin, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';
import { ActivityLogger } from '@/lib/services/activity-logger';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { id: userId } = await params;
    const body = await request.json();

    // Prevent admin from changing their own role (but allow other updates like color)
    if (admin.id === userId && body.role !== undefined) {
      return Response.json(
        { error: 'Admins cannot change their own role' },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServer();

    // Get target user details for logging
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .single();

    // Use the database function for role changes to handle approval logic
    if (body.role) {
      const { error } = await supabase.rpc('update_user_role', {
        p_user_id: userId,
        p_new_role: body.role,
        p_admin_id: admin.id
      });

      if (error) {
        throw error;
      }

      // Log role change
      await ActivityLogger.logUserActivity(
        admin.id,
        'user.role_changed',
        userId,
        {
          old_role: targetUser?.role,
          new_role: body.role,
          admin_id: admin.id,
          user_name: admin.full_name || admin.email,
          target_user_name: targetUser?.full_name || targetUser?.email
        }
      );
    }

    // Handle other user updates (non-role fields)
    const updateData: any = { ...body };
    delete updateData.role; // Remove role as it's handled above
    
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);
        
      if (updateError) {
        throw updateError;
      }

      // Log user update (if color was changed)
      if (updateData.color_index !== undefined) {
        await ActivityLogger.logUserActivity(
          admin.id,
          'user.color_changed',
          userId,
          {
            new_color_index: updateData.color_index,
            new_color: `Color ${updateData.color_index}`,
            admin_id: admin.id,
            user_name: admin.full_name || admin.email,
            target_user_name: targetUser?.full_name || targetUser?.email
          }
        );
      } else if (Object.keys(updateData).length > 0) {
        await ActivityLogger.logUserActivity(
          admin.id,
          'user.profile_updated',
          userId,
          {
            updated_fields: Object.keys(updateData),
            admin_id: admin.id,
            user_name: admin.full_name || admin.email,
            target_user_name: targetUser?.full_name || targetUser?.email
          }
        );
      }
    }

    // Return updated user
    const { data: updatedUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (fetchError) {
      throw fetchError;
    }
    
    return Response.json({ data: updatedUser });
    
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { id: userId } = await params;
    
    // Prevent admin from deleting their own account
    if (admin.id === userId) {
      return Response.json(
        { error: 'Admins cannot delete their own account' },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServer();

    // Get user details before deletion for logging
    const { data: userToDelete } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', userId)
      .single();

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      throw error;
    }

    // Log user deletion
    await ActivityLogger.logUserActivity(
      admin.id,
      'user.deleted',
      userId,
      {
        admin_id: admin.id,
        user_name: admin.full_name || admin.email,
        target_user_name: userToDelete?.full_name || userToDelete?.email
      }
    );

    return Response.json({ message: 'User deleted successfully' });
    
  } catch (error) {
    return handleApiError(error);
  }
}