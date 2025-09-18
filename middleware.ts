import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  console.log(`[Middleware] Processing request: ${request.method} ${request.url}`)

  // Skip middleware for API routes, static files, and images
  if (
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.includes('.')
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
          const cookieOptions = {
            ...options,
            secure: (isProduction || isSecureContext) && !isLocalhost,
            sameSite: 'lax' as const,
            path: '/',
          }

          request.cookies.set({ name, value, ...cookieOptions })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...cookieOptions })
        },
        remove(name: string, options: CookieOptions) {
          const cookieOptions = {
            ...options,
            secure: (isProduction || isSecureContext) && !isLocalhost,
            sameSite: 'lax' as const,
            path: '/',
          }

          request.cookies.set({ name, value: '', ...cookieOptions })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...cookieOptions })
        },
      },
    }
  )

  // Attempt session refresh with error handling
  console.log('[Middleware] Attempting session refresh...')
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    console.log('[Middleware] Session refresh result:', {
      hasUser: !!user,
      userId: user?.id,
      hasError: !!error,
      error: error?.message || 'none'
    })

    // Define route types
    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
    const isHomePage = request.nextUrl.pathname === '/'
    const isPendingPage = request.nextUrl.pathname === '/pending'
    const isDashboardPage = request.nextUrl.pathname === '/dashboard'
    const isPublicRoute = isHomePage || isAuthRoute || isPendingPage

    // Redirect logic for unauthenticated users
    if (!user && !isPublicRoute) {
      console.log('[Middleware] Redirecting unauthenticated user to home')
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // Allow access to pending page for authenticated users
    if (user && isPendingPage) {
      console.log('[Middleware] Allowing authenticated user to access pending page')
      return response
    }

    // Allow access to dashboard for authenticated users
    if (user && isDashboardPage) {
      console.log('[Middleware] Allowing authenticated user to access dashboard')
      return response
    }

  } catch (error) {
    console.warn('[Middleware] Session refresh failed:', error)
    // Continue with request on session refresh failure
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}