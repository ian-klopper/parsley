import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)

  // Log that we reached this endpoint
  console.log('TEST CALLBACK REACHED:', {
    url: url.toString(),
    params: Object.fromEntries(url.searchParams.entries()),
    headers: {
      host: request.headers.get('host'),
      'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    }
  })

  // Return a simple response
  return NextResponse.json({
    success: true,
    message: 'Test callback endpoint reached',
    url: url.toString(),
    params: Object.fromEntries(url.searchParams.entries()),
    timestamp: new Date().toISOString()
  })
}