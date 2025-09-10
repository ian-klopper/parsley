import { supabase } from './supabase'

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    }
  })
  
  if (error) {
    console.error('Error signing in with Google:', error.message)
    return { success: false, error: error.message }
  }
  
  return { success: true, data }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('Error signing out:', error.message)
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error('Error getting current user:', error.message)
    return { user: null, error: error.message }
  }
  
  return { user, error: null }
}