import { NextRequest } from 'next/server';
import { requireAdmin, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';

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