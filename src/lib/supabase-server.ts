import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type cookies } from 'next/headers'
import { Database } from '@/types/database'

export function createClient(cookieStore: ReturnType<typeof cookies>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('Missing Supabase environment variables:', { url: !!url, anonKey: !!anonKey })
    throw new Error('Missing required Supabase environment variables')
  }

  console.log('Creating Supabase server client with URL:', url.substring(0, 30) + '...')

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          const anyStore: any = cookieStore as any
          const raw = anyStore?.get?.(name)?.value as string | undefined
          if (!raw) return undefined
          if (raw.length > 1 && raw.startsWith('"') && raw.endsWith('"')) {
            try {
              return raw.slice(1, -1)
            } catch {
              return raw
            }
          }
          return raw
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            const anyStore: any = cookieStore as any
            anyStore?.set?.({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            const anyStore: any = cookieStore as any
            anyStore?.set?.({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}