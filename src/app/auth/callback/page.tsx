'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const addDebugInfo = (message: string) => {
    console.log(`[AUTH DEBUG] ${message}`)
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        addDebugInfo('🔄 Starting auth callback processing...')
        
        // Check URL for auth tokens
        const urlHash = window.location.hash
        addDebugInfo(`📍 Current URL hash: ${urlHash ? urlHash.substring(0, 100) + '...' : 'No hash'}`)
        
        // Check if we have tokens in the URL
        const hasTokens = urlHash.includes('access_token')
        addDebugInfo(`🔑 Tokens in URL: ${hasTokens ? 'YES' : 'NO'}`)

        if (hasTokens) {
          addDebugInfo('🔄 Processing auth tokens from URL...')
          // Let Supabase process the auth callback
          const { data, error } = await supabase.auth.getSession()
          
          if (error) {
            addDebugInfo(`❌ Auth error: ${error.message}`)
            setError(`Authentication failed: ${error.message}`)
            setTimeout(() => router.push('/?error=auth_failed'), 3000)
            return
          }

          addDebugInfo(`📊 Session check result: ${data.session ? 'Session found' : 'No session'}`)
          
          if (data.session) {
            addDebugInfo(`✅ User authenticated: ${data.session.user.email}`)
            addDebugInfo(`🚀 Redirecting to /jobs in 2 seconds...`)
            setTimeout(() => router.push('/jobs'), 2000)
          } else {
            addDebugInfo('❌ No session found after processing tokens')
            setTimeout(() => router.push('/'), 3000)
          }
        } else {
          // No tokens in URL, just check existing session
          addDebugInfo('🔍 No tokens in URL, checking existing session...')
          const { data } = await supabase.auth.getSession()
          
          if (data.session) {
            addDebugInfo(`✅ Existing session found: ${data.session.user.email}`)
            router.push('/jobs')
          } else {
            addDebugInfo('❌ No existing session, redirecting to login')
            router.push('/')
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        addDebugInfo(`💥 Unexpected error: ${errorMessage}`)
        setError(`Unexpected error: ${errorMessage}`)
        setTimeout(() => router.push('/?error=unexpected'), 3000)
      }
    }

    // Small delay to ensure the auth state is processed
    const timer = setTimeout(handleAuthCallback, 100)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-2">Processing Authentication</h1>
          <p className="text-muted-foreground">Please wait while we complete your sign in...</p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-2">Authentication Error</h3>
            <p>{error}</p>
          </div>
        )}

        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {debugInfo.length === 0 ? (
              <p className="text-muted-foreground">Initializing...</p>
            ) : (
              debugInfo.map((info, index) => (
                <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                  {info}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Check the browser console for additional technical details</p>
        </div>
      </div>
    </div>
  )
}