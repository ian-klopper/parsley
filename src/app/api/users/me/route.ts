import { NextRequest } from 'next/server';
import { handleApiError, createSupabaseServer } from '@/lib/api/auth-middleware';
import { ActivityLogger } from '@/lib/services/activity-logger';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user (but don't require profile to exist yet)
    const supabase = await createSupabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Try to get user profile - it's OK if it doesn't exist
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // If no profile exists, return null (not an error)
    if (error && error.code === 'PGRST116') {
      return Response.json({ data: null });
    }

    // If other error, throw it
    if (error) {
      throw error;
    }

    return Response.json({ data: profile });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user without requiring profile to exist
    const supabase = await createSupabaseServer();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error('Auth error in PUT /api/users/me:', authError);
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('PUT /api/users/me - Auth user:', authUser.id, authUser.email);

    const body = await request.json();
    console.log('Request body:', body);

    // Get the user's profile to get their actual profile ID
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .single();

    if (profileError) {
      console.error('Profile lookup error:', profileError);
      if (profileError.code === 'PGRST116') {
        return Response.json({ error: 'User profile not found' }, { status: 404 });
      }
      throw profileError;
    }

    if (!userProfile) {
      console.error('No profile found for user id:', authUser.id);
      return Response.json({ error: 'User profile not found' }, { status: 404 });
    }

    console.log('Found profile with ID:', userProfile.id);

    // Users can only update their own non-role fields
    const allowedFields = ['full_name', 'avatar_url', 'color_index'];
    const updateData: any = {};

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    console.log('Update data:', updateData);

    // Generate initials if full_name is updated
    if (updateData.full_name) {
      // Simple initials generation without RPC function
      const initials = updateData.full_name
        .split(' ')
        .filter((name: string) => name.length > 0)
        .map((name: string) => name.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2);
      updateData.initials = initials;
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userProfile.id)
      .select('*')
      .single();

    if (error) {
      console.error('Update error:', error);
      throw error;
    }

    // Log profile update (check if color was changed)
    if (updateData.color_index !== undefined) {
      await ActivityLogger.logUserActivity(
        userProfile.id,
        'user.color_changed',
        userProfile.id,
        {
          new_color_index: updateData.color_index
        }
      );
    } else {
      await ActivityLogger.logUserActivity(
        userProfile.id,
        'user.profile_updated',
        userProfile.id,
        {
          updated_fields: Object.keys(updateData)
        }
      );
    }

    console.log('Successfully updated user:', updatedUser.id);
    return Response.json({ data: updatedUser });

  } catch (error) {
    console.error('Unhandled error in PUT /api/users/me:', error);
    return handleApiError(error);
  }
}