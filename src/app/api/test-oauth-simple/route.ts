import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (!code) {
    // Initiate OAuth flow
    const redirectTo = `${url.origin}/api/test-oauth-simple`

    return NextResponse.json({
      message: 'No code provided. To test OAuth:',
      step1: 'Go to Supabase Dashboard > Authentication > Providers > Google',
      step2: 'Make sure Google is enabled',
      step3: `Add this URL to Supabase redirect URLs: ${redirectTo}`,
      step4: 'Then initiate OAuth from the login page',
      currentUrl: url.toString(),
      expectedCallback: redirectTo
    })
  }

  // Try to exchange the code
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  console.log('Test OAuth: Attempting exchange with code:', code.substring(0, 10) + '...')

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      errorDetails: {
        name: error.name,
        status: error.status,
        message: error.message,
        hint: 'This usually means redirect URL mismatch or code already used'
      },
      code: code.substring(0, 10) + '...'
    }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    message: 'OAuth code exchange successful!',
    user: data.user?.email,
    session: !!data.session
  })
}