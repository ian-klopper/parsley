import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // PRODUCTION OPTIMIZATION: Minimal logging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Middleware] ${request.method} ${request.nextUrl.pathname}`)
  }

  // DEVELOPMENT AUTH BYPASS - THE SUPREME OVERRIDE
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true') {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Middleware] 🚀 DEV AUTH BYPASS ENABLED')
    }
    return NextResponse.next()
  }

  // PERFORMANCE: Skip middleware for static assets and API routes
  const { pathname } = request.nextUrl
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|js|css|woff|woff2)$/)
  ) {
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

  // PRODUCTION-OPTIMIZED SESSION CHECK
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    // DEVELOPMENT LOGGING ONLY
    if (process.env.NODE_ENV === 'development') {
      console.log('[Middleware] Auth check:', {
        hasUser: !!user,
        userId: user?.id?.substring(0, 8) + '...',
        hasError: !!error
      })
    }

    // STREAMLINED ROUTE PROTECTION
    const isPublicRoute =
      pathname === '/' ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/test-')

    // FAST REDIRECT FOR UNAUTHENTICATED USERS
    if (!user && !isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // PRODUCTION: Let pages handle detailed user profile checks
    // Middleware should only handle authentication, not authorization

  } catch (error) {
    // PRODUCTION: Silent failure, let pages handle auth state
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Middleware] Session check failed:', error)
    }
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