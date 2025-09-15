import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)

  // Get the expected redirect URL based on the current environment
  const expectedRedirectUrl = `${url.origin}/auth/callback`

  // Information about what should be configured
  const config = {
    instructions: {
      supabase: {
        location: 'Supabase Dashboard > Authentication > URL Configuration',
        required_urls: [
          expectedRedirectUrl,
          'http://localhost:8080/auth/callback' // For local development
        ]
      },
      google: {
        location: 'Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID',
        required_urls: [
          'https://drwytmbsonrfbzxpjkzm.supabase.co/auth/v1/callback'
        ]
      }
    },
    current_environment: {
      origin: url.origin,
      expected_callback: expectedRedirectUrl,
      protocol: url.protocol,
      host: url.host
    },
    debugging: {
      hint: 'The OAuth error "invalid_grant" usually means the redirect URL mismatch or the code was already used',
      common_issues: [
        'Redirect URL in Supabase must match EXACTLY (including trailing slashes)',
        'Google OAuth must have the Supabase callback URL, not your app URL',
        'Ensure no middleware is interfering with the /auth/callback route'
      ]
    }
  }

  return NextResponse.json(config, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  })
}