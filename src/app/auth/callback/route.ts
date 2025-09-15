import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  // Log environment variables status
  console.log('Environment variables check:', {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV
  })

  console.log('OAuth callback received:', {
    code: !!code,
    origin,
    url: requestUrl.toString(),
    searchParams: Object.fromEntries(requestUrl.searchParams.entries())
  })

  if (code) {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Failed to exchange code for session:', error)
      return NextResponse.redirect(`${origin}/`)
    }

    console.log('Successfully exchanged code for session')

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
          return NextResponse.redirect(`${origin}/dashboard`)
        }

        // For other database errors, still try dashboard but log the issue
        console.error('Database error during profile lookup, redirecting to dashboard anyway')
        return NextResponse.redirect(`${origin}/dashboard`)
      }

      console.log('User profile found:', { role: profile.role })

      // Redirect based on role
      if (profile?.role === 'pending') {
        console.log('Redirecting to pending page')
        return NextResponse.redirect(`${origin}/pending`)
      } else {
        console.log('Redirecting to dashboard')
        return NextResponse.redirect(`${origin}/dashboard`)
      }
    } else {
      console.error('No user found after successful session exchange')
    }
  } else {
    console.error('No authorization code received in callback')
  }

  // Return to login page on error
  console.log('Redirecting to login page due to error')
  return NextResponse.redirect(`${origin}/`)
}