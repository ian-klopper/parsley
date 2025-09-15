import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const origin = requestUrl.origin

  // Enhanced logging for debugging
  const debugData = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    request: {
      method: request.method,
      url: requestUrl.toString(),
      origin,
      headers: {
        host: request.headers.get('host'),
        'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
        'x-forwarded-host': request.headers.get('x-forwarded-host'),
      }
    },
    oauth: {
      hasCode: !!code,
      codeLength: code?.length || 0,
      hasError: !!error,
      error,
      errorDescription,
      allParams: Object.fromEntries(requestUrl.searchParams.entries())
    }
  }

  console.log('=== OAuth Callback Debug ===')
  console.log(JSON.stringify(debugData, null, 2))

  // Check for OAuth errors first
  if (error) {
    console.error('OAuth Error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const cookieStore = cookies()

    // Check if we've already processed this code (React StrictMode/double render protection)
    const processedCodes = cookieStore.get('processed_oauth_codes')
    if (processedCodes?.value?.includes(code.substring(0, 10))) {
      console.log('OAuth code already processed, redirecting to dashboard')
      return NextResponse.redirect(`${origin}/dashboard`)
    }

    const supabase = createClient(cookieStore)

    // Log before exchange with more details
    console.log('Attempting to exchange code for session...', {
      codeLength: code.length,
      codePrefix: code.substring(0, 10),
      timestamp: new Date().toISOString(),
      cookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
    })

    // Exchange the code for a session with retry
    let exchangeError = null
    let sessionData = null

    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = await supabase.auth.exchangeCodeForSession(code)
      sessionData = result.data
      exchangeError = result.error

      if (!exchangeError) {
        console.log(`Session exchange successful on attempt ${attempt}`)
        break
      }

      if (attempt === 1) {
        console.log('First exchange attempt failed, retrying...', exchangeError.message)
        await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms before retry
      }
    }

    if (exchangeError) {
      console.error('Failed to exchange code for session after retries:', {
        error: exchangeError,
        message: exchangeError.message,
        status: exchangeError.status,
        name: exchangeError.name,
        hint: exchangeError.hint || 'none',
        code: exchangeError.code || 'none'
      })

      // More specific error messages
      let errorParam = 'exchange_failed'
      if (exchangeError.message?.includes('invalid_grant')) {
        errorParam = 'invalid_grant'
      } else if (exchangeError.message?.includes('redirect_uri_mismatch')) {
        errorParam = 'redirect_mismatch'
      }

      return NextResponse.redirect(`${origin}/?auth_error=${errorParam}&details=${encodeURIComponent(exchangeError.message)}`)
    }

    console.log('Successfully exchanged code for session:', {
      hasSession: !!sessionData?.session,
      hasUser: !!sessionData?.user,
      userId: sessionData?.user?.id,
      userEmail: sessionData?.user?.email
    })

    // Get the user to check their role
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('Failed to get user:', userError)
      return NextResponse.redirect(`${origin}/`)
    }

    if (user) {
      console.log('User found:', { id: user.id, email: user.email })

      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Failed to get user profile:', profileError)

        // If it's a "not found" error, this might be first-time login
        if (profileError.code === 'PGRST116' || profileError.message.includes('No rows returned')) {
          console.log('No profile found (first-time login), redirecting to dashboard')
          return NextResponse.redirect(`${origin}/dashboard`, { status: 302 })
        }

        // For other database errors, still try dashboard but log the issue
        console.error('Database error during profile lookup, redirecting to dashboard anyway')
        return NextResponse.redirect(`${origin}/dashboard`, { status: 302 })
      }

      console.log('User profile found:', { role: profile.role })

      // Redirect based on role
      if (profile?.role === 'pending') {
        console.log('Redirecting to pending page')
        return NextResponse.redirect(`${origin}/pending`, { status: 302 })
      } else {
        console.log('Redirecting to dashboard')
        return NextResponse.redirect(`${origin}/dashboard`, { status: 302 })
      }
    } else {
      console.error('No user found after successful session exchange')
    }
  } else {
    console.error('No authorization code received in callback')
  }

  // Return to login page on error
  console.log('Redirecting to login page due to error')
  return NextResponse.redirect(`${origin}/`, { status: 302 })
}