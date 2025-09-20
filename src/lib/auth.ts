import { supabase } from './supabase'

/**
 * PRODUCTION-OPTIMIZED Google OAuth Sign-In
 * Simplified and secure URL resolution with minimal logging
 */
export async function signInWithGoogle() {
  // FIXED URL RESOLUTION - Solves double-login issue
  const baseUrl = getBaseUrl()
  const redirectTo = `${baseUrl}/auth/callback`

  // DEVELOPMENT BYPASS CHECK
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true') {
    console.log('🚀 DEV AUTH BYPASS - Skipping OAuth')
    return { success: true, bypass: true }
  }

  // PRODUCTION DEBUG: Log URL resolution (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔗 [OAuth] URL Resolution:', {
      baseUrl,
      redirectTo,
      vercelUrl: process.env.NEXT_PUBLIC_VERCEL_URL,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'SSR'
    })
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
 * Fixed for Vercel preview deployments - no more double-login!
 */
function getBaseUrl(): string {
  // SERVER-SIDE: Use Vercel's automatic URL detection
  if (typeof window === 'undefined') {
    // VERCEL AUTOMATIC URL DETECTION
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    if (vercelUrl) {
      return `https://${vercelUrl}`
    }

    // FALLBACK for non-Vercel deployments
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://parsley-three.vercel.app'
  }

  // CLIENT-SIDE: Always use current window location for accuracy
  const { hostname, protocol, port } = window.location

  // DEVELOPMENT
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:8080` // Force port 8080 for dev
  }

  // PRODUCTION/PREVIEW - Use actual current origin (CRITICAL FIX)
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

