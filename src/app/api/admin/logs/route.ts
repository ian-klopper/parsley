import { NextRequest } from 'next/server';
import { requireAdmin, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';
import { ActivityLogger } from '@/lib/services/activity-logger';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    
    const supabase = await createSupabaseServer();
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    
    const { data: logs, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        users:user_id(id, email, full_name, initials, color_index)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) {
      throw error;
    }
    
    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      throw countError;
    }
    
    return Response.json({ 
      data: logs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
    
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);

    const supabase = await createSupabaseServer();

    // Delete all activity logs
    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // This will delete all records

    if (error) {
      throw error;
    }

    // Log this action
    await ActivityLogger.log(
      admin.id,
      'admin.logs_cleared',
      'success',
      {
        admin_id: admin.id,
        user_name: admin.full_name || admin.email,
        cleared_at: new Date().toISOString()
      }
    );

    return Response.json({ message: 'All activity logs cleared successfully' });

  } catch (error) {
    return handleApiError(error);
  }
}