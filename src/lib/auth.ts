import { supabase } from './supabase'

export async function signInWithGoogle() {
  const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1'
  );
  
  const isCloudWorkstation = typeof window !== 'undefined' && 
    window.location.hostname.includes('cloudworkstations.dev');
  
  let baseUrl;
  if (isLocal) {
    baseUrl = `http://localhost:8080`;
  } else if (isCloudWorkstation) {
    baseUrl = `https://${window.location.host}`;
  } else {
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  }
    
  const redirectTo = `${baseUrl}/auth/callback`;
  console.log('Auth redirectTo:', redirectTo, { isLocal, isCloudWorkstation, baseUrl });
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
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