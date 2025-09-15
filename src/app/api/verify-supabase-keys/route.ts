import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Basic validation
  const validation = {
    url: {
      exists: !!url,
      format: url?.includes('supabase.co') ? 'Valid format' : 'Invalid format',
      value: url ? url.substring(0, 40) + '...' : 'MISSING'
    },
    anonKey: {
      exists: !!anonKey,
      length: anonKey?.length || 0,
      startsWithEyJ: anonKey?.startsWith('eyJ') ? 'Valid JWT format' : 'Invalid format',
      preview: anonKey ? anonKey.substring(0, 20) + '...' : 'MISSING'
    }
  }

  // Try to make a simple request to Supabase to verify the keys work
  let connectionTest = { success: false, error: null }

  if (url && anonKey) {
    try {
      const response = await fetch(`${url}/rest/v1/`, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        }
      })

      connectionTest.success = response.ok
      connectionTest.status = response.status

      if (!response.ok) {
        const text = await response.text()
        connectionTest.error = text.substring(0, 200)
      }
    } catch (error) {
      connectionTest.error = error instanceof Error ? error.message : 'Unknown error'
    }
  }

  return NextResponse.json({
    validation,
    connectionTest,
    instructions: {
      ifInvalidApiKey: [
        '1. Go to Vercel Dashboard > Settings > Environment Variables',
        '2. Check NEXT_PUBLIC_SUPABASE_URL matches exactly from .env.local',
        '3. Check NEXT_PUBLIC_SUPABASE_ANON_KEY matches exactly from .env.local',
        '4. Make sure there are no extra spaces or quotes',
        '5. Redeploy after updating'
      ]
    }
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store'
    }
  })
}