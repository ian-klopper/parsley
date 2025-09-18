import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Test the cookie fix
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    return NextResponse.json({
      success: true,
      message: 'Cookie handling works correctly in Next.js 15',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}