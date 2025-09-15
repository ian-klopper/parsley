import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

  console.log('OAuth Debug - All search params:', Object.fromEntries(url.searchParams.entries()))

  if (error) {
    return NextResponse.json({
      error: 'OAuth Error',
      code: error,
      description: errorDescription,
      allParams: Object.fromEntries(url.searchParams.entries())
    })
  }

  if (!code) {
    return NextResponse.json({
      error: 'No authorization code received',
      allParams: Object.fromEntries(url.searchParams.entries()),
      url: url.toString()
    })
  }

  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    console.log('Testing code exchange...')
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.json({
        error: 'Code exchange failed',
        details: exchangeError,
        code: code.substring(0, 10) + '...'
      })
    }

    return NextResponse.json({
      success: true,
      user: data.user ? {
        id: data.user.id,
        email: data.user.email
      } : null,
      session: !!data.session
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}