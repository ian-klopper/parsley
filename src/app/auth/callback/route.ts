import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { User, UserInsert } from '@/types/database'

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
  console.log('Request details:', {
    method: request.method,
    url: requestUrl.toString(),
    origin,
    hasCode: !!code,
    codeLength: code?.length || 0,
    hasError: !!error,
    error,
    allParams: Object.fromEntries(requestUrl.searchParams.entries())
  })

  // Check for OAuth errors first
  if (error) {
    console.error('OAuth Error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const cookieStore = await cookies()

    // Check if we've already processed this code (React StrictMode/double render protection)
    const processedCodesCookie = cookieStore.get('processed_oauth_codes')
    const processedCodes = processedCodesCookie?.value
    if (processedCodes?.includes(code.substring(0, 10))) {
      console.log('OAuth code already processed, redirecting to dashboard')
      return NextResponse.redirect(`${origin}/dashboard`)
    }

    const supabase = createClient(cookieStore)

    // Log before exchange with more details
    const allCookies = cookieStore.getAll()
    console.log('[OAuth Callback] Attempting to exchange code for session...', {
      codeLength: code.length,
      codePrefix: code.substring(0, 10),
      timestamp: new Date().toISOString(),
      cookiesCount: allCookies.length,
      cookieNames: allCookies.map((c: any) => c.name)
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
      console.error('[OAuth Callback] Failed to exchange code for session after retries:', {
        error: exchangeError,
        message: exchangeError.message,
        status: exchangeError.status,
        name: exchangeError.name,
        hint: (exchangeError as any).hint || 'none',
        code: (exchangeError as any).code || 'none'
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

    console.log('[OAuth Callback] Successfully exchanged code for session:', {
      hasSession: !!sessionData?.session,
      hasUser: !!sessionData?.user,
      userId: sessionData?.user?.id,
      userEmail: sessionData?.user?.email,
      sessionAccessToken: !!sessionData?.session?.access_token,
      sessionRefreshToken: !!sessionData?.session?.refresh_token,
      sessionExpiresAt: sessionData?.session?.expires_at
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
        .single() as { data: Pick<User, 'role'> | null; error: any }

      if (profileError) {
        console.error('Failed to get user profile:', profileError)

        // If it's a "not found" error, this is a first-time login - create the profile
        if (profileError.code === 'PGRST116' || profileError.message.includes('No rows returned')) {
          console.log('No profile found (first-time login), creating user profile...')
          
          // Create user profile with retry logic for production reliability
          let createAttempts = 0
          let newProfile = null
          let createError = null

          while (createAttempts < 3 && !newProfile) {
            createAttempts++
            console.log(`[OAuth Callback] User creation attempt ${createAttempts}/3`)

            const userInsert: UserInsert = {
              id: user.id,
              email: user.email || '',
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
              role: 'pending' as const,
              avatar_url: user.user_metadata?.avatar_url || null,
              color_index: Math.floor(Math.random() * 12)
            }

            // Simple approach - create user and handle errors gracefully
            try {
              const insertResult = await fetch('/api/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: user.id,
                  email: user.email || '',
                  full_name: userInsert.full_name,
                  avatar_url: userInsert.avatar_url,
                  color_index: userInsert.color_index
                })
              })

              if (insertResult.ok) {
                const userData = await insertResult.json()
                newProfile = { role: userData.role || 'pending' }
                createError = null
                console.log('✅ User created via API endpoint')
              } else {
                const errorData = await insertResult.json()
                createError = { message: errorData.error || 'API creation failed' }
              }
            } catch (apiError) {
              console.log('API approach failed, trying direct database...')
              // Fallback to direct approach with any casting
              try {
                const directResult = await (supabase as any)
                  .from('users')
                  .insert([{
                    id: user.id,
                    email: user.email || '',
                    full_name: userInsert.full_name,
                    role: 'pending',
                    avatar_url: userInsert.avatar_url,
                    color_index: userInsert.color_index
                  }])
                  .select('role')
                  .single()

                newProfile = directResult.data
                createError = directResult.error
              } catch (dbError) {
                createError = { message: 'All creation methods failed' }
              }
            }

            if (!createError) {
              console.log('✅ User profile created successfully on attempt', createAttempts)
              break
            }

            if (createError.code === '23505') {
              // User already exists (race condition), try to fetch it
              console.log('User already exists, fetching existing profile...')
              const { data: existingProfile, error: fetchError } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single() as { data: Pick<User, 'role'> | null; error: any }

              if (!fetchError && existingProfile) {
                newProfile = existingProfile
                createError = null
                break
              }
            }

            if (createAttempts < 3) {
              console.log(`Attempt ${createAttempts} failed, retrying in 1s...`, createError.message)
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }

          if (createError && !newProfile) {
            console.error('Failed to create user profile after all attempts:', createError)
            // Still redirect to dashboard, but user might have issues
            return NextResponse.redirect(`${origin}/dashboard?auth_error=profile_creation_failed`, { status: 302 })
          }

          console.log('✅ User profile ready:', { role: newProfile?.role })
          
          // Redirect based on the user's role
          if (newProfile?.role === 'pending') {
            console.log('Redirecting new user to pending page')
            return NextResponse.redirect(`${origin}/pending`, { status: 302 })
          } else {
            console.log('Redirecting new user to dashboard')
            return NextResponse.redirect(`${origin}/dashboard`, { status: 302 })
          }
        }

        // For other database errors, still try dashboard but log the issue
        console.error('Database error during profile lookup, redirecting to dashboard anyway')
        return NextResponse.redirect(`${origin}/dashboard?auth_error=database_error`, { status: 302 })
      }

      console.log('User profile found:', { role: (profile as any)?.role })

      // Redirect based on role with enhanced logging
      if (profile?.role === 'pending') {
        console.log('✅ Redirecting to pending page - user has pending role')
        console.log('Redirect URL:', `${origin}/pending`)
        const response = NextResponse.redirect(`${origin}/pending`, { status: 302 })
        
        // Ensure session cookies are properly set for the redirect
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        const authCookies = allCookies.filter(cookie => 
          cookie.name.includes('supabase') || 
          cookie.name.includes('auth') ||
          cookie.name.includes('session')
        )
        
        console.log('Auth cookies being preserved:', authCookies.map(c => c.name))
        return response
      } else {
        console.log('✅ Redirecting to dashboard - user role:', profile?.role)
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