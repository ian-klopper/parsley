import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin

  console.log('Test redirect called from:', origin)
  console.log('Full URL:', url.toString())

  // Test redirect to dashboard
  console.log('Redirecting to dashboard...')
  return NextResponse.redirect(`${origin}/dashboard`)
}