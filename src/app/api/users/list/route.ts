import { NextRequest } from 'next/server';
import { requireAuth, handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Any authenticated user can see the list of active users (for collaboration)
    await requireAuth(request);

    const supabase = await createSupabaseServer();

    // Only return active users (not pending)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, initials, color_index, role')
      .neq('role', 'pending')
      .order('full_name', { ascending: true });

    if (error) {
      throw error;
    }

    return Response.json({ data: users });

  } catch (error) {
    return handleApiError(error);
  }
}