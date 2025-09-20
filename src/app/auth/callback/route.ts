import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * PRODUCTION-OPTIMIZED OAuth Callback Handler
 * Streamlined, secure, and fast authentication flow
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const origin = requestUrl.origin

  // DEVELOPMENT LOGGING ONLY
  if (process.env.NODE_ENV === 'development') {
    console.log('[Callback] Processing OAuth callback:', {
      hasCode: !!code,
      hasError: !!error,
      error
    })
  }

  // FAST ERROR HANDLING
  if (error) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=no_code`)
  }

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // SESSION EXCHANGE - Single attempt for production speed
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      const errorParam = exchangeError.message?.includes('invalid_grant') ? 'invalid_grant' : 'exchange_failed'
      if (process.env.NODE_ENV === 'development') {
        console.error('[Callback] Session exchange failed:', exchangeError.message)
      }
      return NextResponse.redirect(`${origin}/?auth_error=${errorParam}`)
    }

    if (!sessionData?.user) {
      return NextResponse.redirect(`${origin}/?auth_error=no_user`)
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Callback] Session exchange successful:', sessionData.user.email)
    }

    // USER PROFILE CHECK - Streamlined database query
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', sessionData.user.id)
      .single()

    // HANDLE NEW USER
    if (profileError?.code === 'PGRST116') {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Callback] Creating new user profile')
      }

      // Create new user profile
      const { error: createError } = await supabase
        .from('users')
        .insert({
          id: sessionData.user.id,
          email: sessionData.user.email || '',
          full_name: sessionData.user.user_metadata?.full_name ||
                    sessionData.user.user_metadata?.name ||
                    sessionData.user.email?.split('@')[0] || '',
          role: 'pending',
          avatar_url: sessionData.user.user_metadata?.avatar_url || null,
          color_index: Math.floor(Math.random() * 12)
        })

      if (createError && createError.code !== '23505') {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Callback] Profile creation failed:', createError)
        }
        return NextResponse.redirect(`${origin}/dashboard?auth_error=profile_creation_failed`)
      }

      // New users go to pending page
      return NextResponse.redirect(`${origin}/pending`)
    }

    // HANDLE EXISTING USER
    if (profileError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Callback] Profile lookup failed:', profileError)
      }
      return NextResponse.redirect(`${origin}/dashboard?auth_error=database_error`)
    }

    // REDIRECT BASED ON ROLE
    const redirectPath = profile?.role === 'pending' ? '/pending' : '/dashboard'

    if (process.env.NODE_ENV === 'development') {
      console.log('[Callback] Redirecting to:', redirectPath, 'for role:', profile?.role)
    }

    return NextResponse.redirect(`${origin}${redirectPath}`)

  } catch (error) {
    // PRODUCTION: Generic error handling
    if (process.env.NODE_ENV === 'development') {
      console.error('[Callback] Unexpected error:', error)
    }
    return NextResponse.redirect(`${origin}/?auth_error=server_error`)
  }
}