import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  console.log(`[Middleware] Processing request: ${request.method} ${request.url}`)

  // Skip middleware for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const isProduction = process.env.NODE_ENV === 'production'
  const isSecureContext = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https'
  const isLocalhost = request.headers.get('host')?.includes('localhost') || request.headers.get('host')?.includes('127.0.0.1')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set secure flag based on environment
          const cookieOptions = {
            ...options,
            secure: (isProduction || isSecureContext) && !isLocalhost ? true : options?.secure || false,
            sameSite: options?.sameSite || 'lax',
            path: options?.path || '/',
          } as CookieOptions

          request.cookies.set({
            name,
            value,
            ...cookieOptions,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...cookieOptions,
          })
        },
        remove(name: string, options: CookieOptions) {
          const cookieOptions = {
            ...options,
            secure: (isProduction || isSecureContext) && !isLocalhost ? true : options?.secure || false,
            sameSite: options?.sameSite || 'lax',
            path: options?.path || '/',
          } as CookieOptions

          request.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          })
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  console.log('[Middleware] Attempting session refresh...')
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    console.log('[Middleware] Session refresh result:', {
      hasUser: !!user,
      userId: user?.id,
      hasError: !!error,
      error: error?.message || 'none'
    })

    // Check if this is a protected route
    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
    const isHomePage = request.nextUrl.pathname === '/'
    const isPublicRoute = isHomePage || isAuthRoute || request.nextUrl.pathname.startsWith('/test-')

    // If user is not authenticated and trying to access protected routes
    if (!user && !isPublicRoute) {
      console.log('[Middleware] Redirecting to home page - no authentication')
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // If user is authenticated but has no profile, they might be pending
    if (user && !isAuthRoute && !isHomePage) {
      // Let the pages handle profile checks, don't block here
      console.log('[Middleware] Authenticated user accessing:', request.nextUrl.pathname)
    }

  } catch (error) {
    console.warn('[Middleware] Session refresh failed:', error)
    // Continue with the request even if session refresh fails
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}