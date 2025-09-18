import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// Client-side Supabase client with proper cookie handling
export function createClient() {
  // Detect if we're in a secure context (HTTPS) - exclude localhost for development
  const isSecure = typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return undefined
          const cookies = document.cookie.split('; ')
          const cookie = cookies.find(c => c.startsWith(`${name}=`))
          if (!cookie) {
            console.log(`[Supabase Cookie] GET ${name}: NOT FOUND`)
            return undefined
          }
          let value = decodeURIComponent(cookie.split('=')[1])
          // Normalize accidental double-encoded JSON strings (e.g., "{...}")
          if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
            try {
              // Remove the wrapping quotes so the library's JSON.parse returns an object
              value = value.slice(1, -1)
            } catch (_) {
              // no-op; return original value
            }
          }
          console.log(`[Supabase Cookie] GET ${name}: FOUND (${value.length} chars)`)
          return value
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

          console.log(`[Supabase Cookie] SET ${name}: ${cookieString}`)
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

          console.log(`[Supabase Cookie] REMOVE ${name}: ${cookieString}`)
          document.cookie = cookieString
        }
      }
    }
  )
}

// Create a singleton instance for backward compatibility
console.log('Creating Supabase browser client with URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Browser client secure context detection:', {
  protocol: typeof window !== 'undefined' ? window.location.protocol : 'SSR',
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'SSR',
  isSecure: typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
});
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