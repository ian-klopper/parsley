import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  // Test redirect functionality
  const url = new URL(request.url)
  if (url.searchParams.get('redirect') === 'test') {
    console.log('Testing redirect from test-env endpoint')
    console.log('Redirect URL:', `${url.origin}/dashboard`)

    try {
      const redirectResponse = NextResponse.redirect(`${url.origin}/dashboard`)
      console.log('Redirect response created successfully')
      return redirectResponse
    } catch (error) {
      console.error('Redirect failed:', error)
      return NextResponse.json({ error: 'Redirect failed', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
    }
  }
  try {
    // Check environment variables
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL ?
          `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...` : 'undefined'
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?
          `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'undefined'
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        value: process.env.SUPABASE_SERVICE_ROLE_KEY ?
          `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'undefined'
      }
    }

    console.log('Environment Variables Check:', envCheck)

    // Test Supabase connection with anon key (normal client)
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data: session, error: sessionError } = await supabase.auth.getSession()

    console.log('Supabase connection test:', {
      sessionExists: !!session?.session,
      sessionError: sessionError?.message,
      user: session?.session?.user ? {
        id: session.session.user.id,
        email: session.session.user.email
      } : null
    })

    // Test database connectivity with service role key
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: dbTest, error: dbError } = await serviceSupabase
      .from('users')
      .select('count')
      .limit(1)

    console.log('Database connectivity test:', {
      success: !dbError,
      error: dbError?.message
    })

    return NextResponse.json({
      environment: envCheck,
      supabase: {
        sessionExists: !!session?.session,
        sessionError: sessionError?.message,
        dbConnectivity: !dbError,
        dbError: dbError?.message
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Environment test failed:', error)
    return NextResponse.json({
      error: 'Environment test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}