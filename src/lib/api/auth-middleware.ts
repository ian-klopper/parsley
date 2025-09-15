import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Called from Server Component - ignore
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Called from Server Component - ignore
          }
        },
      },
    }
  );
}

export function createSupabaseServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'pending' | 'user' | 'admin';
  full_name?: string;
}

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function requireSession(request: NextRequest) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Authentication required');
  }

  return { user, supabase };
}

export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser> {
  const supabase = await createSupabaseServer();

  const { data: { user: authUser }, error } = await supabase.auth.getUser();

  if (error || !authUser) {
    throw new AuthError('Authentication required');
  }

  // Get user profile with role (using auth.users.id directly)
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, role, full_name')
    .eq('id', authUser.id)
    .single();

  if (userError || !user) {
    throw new AuthError('User profile not found');
  }

  return user as AuthenticatedUser;
}

export async function requireRole(
  request: NextRequest, 
  allowedRoles: ('pending' | 'user' | 'admin')[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);
  
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Access denied. Required role: ${allowedRoles.join(' or ')}, current role: ${user.role}`
    );
  }
  
  return user;
}

export async function requireAdmin(request: NextRequest): Promise<AuthenticatedUser> {
  return requireRole(request, ['admin']);
}

export async function requireNonPending(request: NextRequest): Promise<AuthenticatedUser> {
  return requireRole(request, ['user', 'admin']);
}

export function handleApiError(error: unknown) {
  // Always log the full error details
  console.error('🚨 API Error Caught:', {
    error,
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    type: error?.constructor?.name
  });

  if (error instanceof AuthError) {
    return Response.json(
      {
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: error.status }
    );
  }

  if (error instanceof ForbiddenError) {
    return Response.json(
      {
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 403 }
    );
  }

  // For database errors, provide more detail
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as any;
    const errorMessage = `Database Error (${dbError.code}): ${dbError.message || dbError.detail || 'Unknown database error'}`;

    return Response.json(
      {
        error: errorMessage,
        code: dbError.code,
        details: process.env.NODE_ENV === 'development' ? dbError : undefined
      },
      { status: 500 }
    );
  }

  // Always return detailed error messages
  const errorMessage = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : `Internal server error: ${JSON.stringify(error)}`;

  return Response.json(
    {
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    },
    { status: 500 }
  );
}