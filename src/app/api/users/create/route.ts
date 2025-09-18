import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, email, full_name, avatar_url, color_index } = body

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('[User Creation API] Creating user:', { id, email })

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Create user profile using service role key (should have permissions)
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: newUser, error: createError } = await serviceSupabase
      .from('users')
      .insert([{
        id,
        email,
        full_name: full_name || email.split('@')[0],
        role: 'pending',
        avatar_url: avatar_url || null,
        color_index: color_index ?? Math.floor(Math.random() * 12)
      }])
      .select('*')
      .single()

    if (createError) {
      // Check if it's a duplicate key error
      if (createError.code === '23505') {
        // User already exists, fetch the existing user
        const { data: existingUser, error: fetchError } = await serviceSupabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single()

        if (existingUser) {
          console.log('[User Creation API] User already exists:', existingUser.id)
          return NextResponse.json(existingUser)
        }
      }

      console.error('[User Creation API] Failed to create user:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    console.log('[User Creation API] ✅ User created successfully:', newUser.id)
    return NextResponse.json(newUser)

  } catch (error) {
    console.error('[User Creation API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}