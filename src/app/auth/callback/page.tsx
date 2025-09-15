'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LoadingWithTips } from '@/components/LoadingWithTips'
import { authTips } from '@/lib/loading-tips'
import type { User } from '@supabase/supabase-js'

// Helper function to ensure user profile exists
async function ensureUserProfile(user: User) {
  try {
    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    // If profile doesn't exist, create it
    if (!existingProfile) {
      const { error: createError } = await supabase
        .from('users')
        .insert([{
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email!.split('@')[0],
          role: 'pending',
          avatar_url: user.user_metadata?.avatar_url,
          color_index: Math.floor(Math.random() * 12)
        }])

      if (createError) {
        throw createError
      }

      console.log('✅ Created user profile for:', user.email)
    }
  } catch (error) {
    console.error('❌ Error ensuring user profile:', error)
    throw error
  }
}

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setIsProcessing(true)

        // Check URL for auth tokens in both hash and search params
        const urlHash = window.location.hash
        const urlSearch = window.location.search

        // Check if we have tokens in the URL (hash or search params)
        const hasTokensInHash = urlHash.includes('access_token')
        const hasTokensInSearch = urlSearch.includes('code=') || urlSearch.includes('access_token')
        const hasTokens = hasTokensInHash || hasTokensInSearch

        if (hasTokens) {
          // Use Supabase's session from URL method for better token handling
          const { data, error } = await supabase.auth.getSession()

          // If no session from getSession, try to exchange code/tokens
          if (!data.session && (hasTokensInHash || hasTokensInSearch)) {
            // Listen for auth state change
            const { data: authData, error: authError } = await new Promise<{ data: { session: any }, error: Error | null }>((resolve) => {
              const unsubscribe = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session) {
                  unsubscribe.data.subscription.unsubscribe()
                  resolve({ data: { session }, error: null })
                } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                  // Continue waiting
                }
              })

              // Timeout after 10 seconds
              setTimeout(() => {
                unsubscribe.data.subscription.unsubscribe()
                resolve({ data: { session: null }, error: new Error('Authentication timeout - please try signing in again') })
              }, 10000)
            })

            if (authError) {
              throw new Error(`Authentication failed: ${authError.message}`)
            }

            if (authData.session) {
              // Check if user profile exists, create if not
              await ensureUserProfile(authData.session.user)

              // Check user role and redirect accordingly
              const { data: profile } = await supabase
                .from('users')
                .select('role')
                .eq('id', authData.session.user.id)
                .single()

              setIsProcessing(false)

              if (profile?.role === 'pending') {
                router.push('/pending')
              } else {
                router.push('/dashboard')
              }
              return
            }
          }

          if (error) {
            throw new Error(`Authentication failed: ${error.message}`)
          }

          if (data.session) {
            // Check if user profile exists, create if not
            await ensureUserProfile(data.session.user)

            // Check user role and redirect accordingly
            const { data: profile } = await supabase
              .from('users')
              .select('role')
              .eq('id', data.session.user.id)
              .single()

            setIsProcessing(false)

            if (profile?.role === 'pending') {
              router.push('/pending')
            } else {
              router.push('/dashboard')
            }
          } else {
            throw new Error('Authentication failed - no session found')
          }
        } else {
          // No tokens in URL, just check existing session
          const { data } = await supabase.auth.getSession()

          if (data.session) {
            // Check if user profile exists, create if not
            await ensureUserProfile(data.session.user)

            // Check user role and redirect accordingly
            const { data: profile } = await supabase
              .from('users')
              .select('role')
              .eq('id', data.session.user.id)
              .single()

            setIsProcessing(false)

            if (profile?.role === 'pending') {
              router.push('/pending')
            } else {
              router.push('/dashboard')
            }
          } else {
            setIsProcessing(false)
            router.push('/')
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during authentication'
        setError(errorMessage)
        setIsProcessing(false)

        // Redirect to login with error after showing error for 3 seconds
        setTimeout(() => {
          router.push(`/?error=${encodeURIComponent(errorMessage)}`)
        }, 3000)
      }
    }

    // Small delay to ensure the auth state is processed
    const timer = setTimeout(handleAuthCallback, 200)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      {isProcessing ? (
        <LoadingWithTips
          title="Signing you in"
          subtitle="Please wait while we complete your authentication..."
          tips={authTips}
          size="md"
          className="min-h-screen p-8"
        />
      ) : error ? (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-md mx-auto text-center">
            <div className="text-foreground mb-6">
              <svg className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-4 text-foreground">Authentication Error</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting you back to the login page...</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}