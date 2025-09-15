import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get the user to check their role
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check if user profile exists
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        // Redirect based on role
        if (profile?.role === 'pending') {
          return NextResponse.redirect(`${origin}/pending`)
        } else {
          return NextResponse.redirect(`${origin}/dashboard`)
        }
      }
    }
  }

  // Return to login page on error
  return NextResponse.redirect(`${origin}/`)
}