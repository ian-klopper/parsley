import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET() {
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

    // Test Supabase connection
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

    // Test basic database connectivity
    const { data: dbTest, error: dbError } = await supabase
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