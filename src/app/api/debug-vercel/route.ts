import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const cookieStore = cookies()

  // Get all cookies
  const allCookies = cookieStore.getAll()

  // Check for Supabase auth cookies
  const authCookies = allCookies.filter(c =>
    c.name.includes('sb-') ||
    c.name.includes('supabase')
  )

  const debugInfo = {
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    },
    request: {
      url: url.toString(),
      origin: url.origin,
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      headers: {
        'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
        'x-forwarded-host': request.headers.get('x-forwarded-host'),
        host: request.headers.get('host'),
      }
    },
    cookies: {
      totalCookies: allCookies.length,
      authCookies: authCookies.map(c => ({
        name: c.name,
        hasValue: !!c.value,
        length: c.value?.length || 0
      }))
    },
    timestamp: new Date().toISOString()
  }

  return NextResponse.json(debugInfo, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store'
    }
  })
}