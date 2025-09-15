import { NextRequest } from 'next/server';
import { requireAdmin, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    
    const supabase = await createSupabaseServer();
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      throw error;
    }
    
    return Response.json({ data: users });
    
  } catch (error) {
    return handleApiError(error);
  }
}