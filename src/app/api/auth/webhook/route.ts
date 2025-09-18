import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { UserInsert } from '@/types/database'

export async function POST(request: Request) {
  try {
    // Verify the webhook is from Supabase (you should add a secret verification in production)
    const body = await request.json()
    
    console.log('[Auth Webhook] Received webhook:', {
      type: body.type,
      table: body.table,
      record: body.record ? { id: body.record.id, email: body.record.email } : null
    })

    // Only handle user creation events
    if (body.type !== 'INSERT' || body.table !== 'users' || !body.record) {
      console.log('[Auth Webhook] Ignoring non-user-insert event')
      return NextResponse.json({ message: 'Event ignored' })
    }

    const authUser = body.record
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // Check if user profile already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .single()

    if (existingUser) {
      console.log('[Auth Webhook] User profile already exists:', authUser.id)
      return NextResponse.json({ message: 'User already exists' })
    }

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[Auth Webhook] Error checking existing user:', checkError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Create user profile
    const userInsert: UserInsert = {
      id: authUser.id,
      email: authUser.email || '',
      full_name: authUser.raw_user_meta_data?.full_name || 
                 authUser.raw_user_meta_data?.name || 
                 authUser.email?.split('@')[0] || '',
      role: 'pending',
      avatar_url: authUser.raw_user_meta_data?.avatar_url || null,
      color_index: Math.floor(Math.random() * 12)
    }

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([userInsert])
      .select('*')
      .single() as { data: any; error: any }

    if (createError) {
      console.error('[Auth Webhook] Failed to create user profile:', createError)
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    console.log('[Auth Webhook] ✅ User profile created successfully:', {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    })

    return NextResponse.json({ 
      message: 'User profile created successfully',
      user: newUser
    })

  } catch (error) {
    console.error('[Auth Webhook] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}