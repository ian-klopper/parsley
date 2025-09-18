import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type cookies } from 'next/headers'
import { Database } from '@/types/database'

export function createClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
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
        get: async (name: string) => {
          const cookie = cookieStore.get(name);
          if (!cookie) return undefined;
          const raw = cookie.value;
          if (!raw) return undefined;
          if (raw.length > 1 && raw.startsWith('"') && raw.endsWith('"')) {
            try {
              return raw.slice(1, -1);
            } catch {
              return raw;
            }
          }
          return raw;
        },
        set: async (name: string, value: string, options: CookieOptions) => {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove: async (name: string, options: CookieOptions) => {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
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