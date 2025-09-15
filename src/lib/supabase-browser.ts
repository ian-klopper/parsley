import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// Client-side Supabase client with proper cookie handling
export function createClient() {
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

          if (options?.maxAge) {
            cookieString += `; Max-Age=${options.maxAge}`
          }
          if (options?.path) {
            cookieString += `; Path=${options.path}`
          }
          if (options?.domain) {
            cookieString += `; Domain=${options.domain}`
          }
          if (options?.sameSite) {
            cookieString += `; SameSite=${options.sameSite}`
          }
          if (options?.secure) {
            cookieString += `; Secure`
          }

          document.cookie = cookieString
        },
        remove(name: string, options?: any) {
          if (typeof document === 'undefined') return
          let cookieString = `${name}=; Max-Age=0`

          if (options?.path) {
            cookieString += `; Path=${options.path}`
          }
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