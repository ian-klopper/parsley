import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Diagnosing simple-extract endpoint issues...');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      platform: process.platform,
      nodeVersion: process.version,
      vercelEnv: process.env.VERCEL_ENV,
      hasGoogleAIKey: !!process.env.GOOGLE_AI_API_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      tmpDir: '/tmp',
      checks: {}
    };

    // Test 1: Can we import the extraction module?
    try {
      const extractor = await import('@/lib/extraction-v2/simple-extractor');
      diagnostics.checks.extractorImport = 'SUCCESS';
      diagnostics.checks.availableFunctions = Object.keys(extractor);
    } catch (error) {
      diagnostics.checks.extractorImport = `FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Test 2: Can we create temp files?
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      const tempDir = os.tmpdir();
      const testFile = path.join(tempDir, `test-${Date.now()}.txt`);
      fs.writeFileSync(testFile, 'test content');
      fs.unlinkSync(testFile);
      
      diagnostics.checks.fileSystem = 'SUCCESS';
      diagnostics.checks.tempDir = tempDir;
    } catch (error) {
      diagnostics.checks.fileSystem = `FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Test 3: Can we initialize Google AI clients?
    try {
      if (process.env.GOOGLE_AI_API_KEY) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        diagnostics.checks.googleAI = 'SUCCESS';
      } else {
        diagnostics.checks.googleAI = 'FAILED: No API key';
      }
    } catch (error) {
      diagnostics.checks.googleAI = `FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Test 4: Can we create Supabase clients?
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      diagnostics.checks.supabase = 'SUCCESS';
    } catch (error) {
      diagnostics.checks.supabase = `FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Test 5: Memory and limits
    try {
      const memUsage = process.memoryUsage();
      diagnostics.checks.memory = {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
      };
    } catch (error) {
      diagnostics.checks.memory = `FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    console.log('📊 Diagnostics completed:', diagnostics);
    
    return NextResponse.json(diagnostics);
  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
    return NextResponse.json({
      error: 'Diagnostics failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}