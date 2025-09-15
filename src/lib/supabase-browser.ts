import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// Client-side Supabase client with proper cookie handling
export function createClient() {
  // Detect if we're in a secure context (HTTPS)
  const isSecure = typeof window !== 'undefined' &&
    (window.location.protocol === 'https:' || window.location.hostname === 'localhost')

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return undefined
          const cookies = document.cookie.split('; ')
          const cookie = cookies.find(c => c.startsWith(`${name}=`))
          return cookie ? decodeURIComponent(cookie.split('=')[1]) : undefined
        },
        set(name: string, value: string, options?: any) {
          if (typeof document === 'undefined') return
          let cookieString = `${name}=${encodeURIComponent(value)}`

          // Always set path to root for OAuth cookies
          const path = options?.path || '/'
          cookieString += `; Path=${path}`

          if (options?.maxAge) {
            cookieString += `; Max-Age=${options.maxAge}`
          }

          if (options?.domain) {
            cookieString += `; Domain=${options.domain}`
          }

          // Set SameSite=Lax for OAuth compatibility (allows cookies on redirects)
          // Use None for cross-origin requests if needed
          const sameSite = options?.sameSite || 'Lax'
          cookieString += `; SameSite=${sameSite}`

          // Always set Secure flag in production (HTTPS)
          if (isSecure || options?.secure) {
            cookieString += `; Secure`
          }

          document.cookie = cookieString
        },
        remove(name: string, options?: any) {
          if (typeof document === 'undefined') return
          let cookieString = `${name}=; Max-Age=0`

          // Always use root path for removal
          const path = options?.path || '/'
          cookieString += `; Path=${path}`

          if (options?.domain) {
            cookieString += `; Domain=${options.domain}`
          }

          document.cookie = cookieString
        }
      }
    }
  )
}

// Create a singleton instance for backward compatibility
console.log('Creating Supabase browser client with URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabase = createClient()

// Test function to verify connection
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error('Supabase connection error:', error.message)
      return { success: false, error: error.message }
    }

    console.log('✅ Supabase connection successful')
    return { success: true, data }
  } catch (error) {
    console.error('Supabase connection failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}