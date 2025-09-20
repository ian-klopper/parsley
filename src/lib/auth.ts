import { supabase } from './supabase'

/**
 * PRODUCTION-OPTIMIZED Google OAuth Sign-In
 * Simplified and secure URL resolution with minimal logging
 */
export async function signInWithGoogle() {
  // SIMPLIFIED URL RESOLUTION - More reliable and secure
  const baseUrl = getBaseUrl()
  const redirectTo = `${baseUrl}/auth/callback`

  // DEVELOPMENT BYPASS CHECK
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true') {
    console.log('🚀 DEV AUTH BYPASS - Skipping OAuth')
    return { success: true, bypass: true }
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account', // Better UX than 'consent'
        },
        skipBrowserRedirect: false
      }
    })

    if (error) {
      // PRODUCTION-SAFE ERROR LOGGING
      if (process.env.NODE_ENV === 'development') {
        console.error('OAuth Error:', error.message)
      }
      return { success: false, error: 'Authentication failed. Please try again.' }
    }

    return { success: true, data }
  } catch (error) {
    // CATCH-ALL ERROR HANDLING
    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected OAuth error:', error)
    }
    return { success: false, error: 'Authentication service unavailable.' }
  }
}

/**
 * PRODUCTION-OPTIMIZED URL RESOLUTION
 * Single source of truth for base URL determination
 */
function getBaseUrl(): string {
  // SERVER-SIDE: Use environment variable
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://parsley-three.vercel.app'
  }

  // CLIENT-SIDE: Smart environment detection
  const { hostname, protocol, port } = window.location

  // DEVELOPMENT
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:8080` // Force port 8080 for dev
  }

  // PRODUCTION - Use current origin
  return `${protocol}//${hostname}${port && port !== '80' && port !== '443' ? `:${port}` : ''}`
}

/**
 * PRODUCTION-OPTIMIZED Sign Out
 * Secure sign-out with proper error handling
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Sign out error:', error.message)
      }
      return { success: false, error: 'Sign out failed. Please try again.' }
    }

    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected sign out error:', error)
    }
    return { success: false, error: 'Sign out service unavailable.' }
  }
}

/**
 * PRODUCTION-OPTIMIZED User Retrieval
 * Fast user lookup with minimal error exposure
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      // Don't log auth errors in production - they're often expected
      return { user: null, error: null }
    }

    return { user, error: null }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected user retrieval error:', error)
    }
    return { user: null, error: null }
  }
}

