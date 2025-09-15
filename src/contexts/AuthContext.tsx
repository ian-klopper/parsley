'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User as AuthUser } from '@supabase/supabase-js'
import { User } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { UserService } from '@/lib/user-service'

interface AuthContextType {
  user: AuthUser | null
  userProfile: User | null
  loading: boolean
  hasAccess: boolean
  isAdmin: boolean
  isAuthenticated: boolean
  isPendingApproval: boolean
  error: string | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  hasAccess: false,
  isAdmin: false,
  isAuthenticated: false,
  isPendingApproval: false,
  error: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  clearError: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Computed states
  const isAuthenticated = Boolean(user)
  const isPendingApproval = Boolean(user && !userProfile)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setUserProfile(null)
      setHasAccess(false)
      setIsAdmin(false)
      setError(null)
      return
    }

    try {
      setError(null)
      const { data: profile, error } = await UserService.getCurrentUser()

      if (error) {
        // If it's just a "user not found" error for new users, don't show as error
        if (error.includes('User profile not found')) {
          setUserProfile(null)
          setHasAccess(false)
          setIsAdmin(false)
        } else {
          throw new Error(`Failed to fetch user profile: ${error}`)
        }
      } else {
        // profile can be null for new users - this is normal
        setUserProfile(profile)
        setHasAccess(profile?.role === 'admin' || profile?.role === 'user')
        setIsAdmin(profile?.role === 'admin')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user profile'
      setError(errorMessage)
      setUserProfile(null)
      setHasAccess(false)
      setIsAdmin(false)
    }
  }, [user])

  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
          throw new Error(`Authentication error: ${error.message}`)
        }

        setUser(user ?? null)
        setLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get user session'
        setError(errorMessage)
        setUser(null)
        setLoading(false)
      }
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          // Clear previous errors when auth state changes
          setError(null)

          // For client-side auth state changes, session.user is safe to use
          setUser(session?.user ?? null)
          setLoading(false)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Authentication state change error'
          setError(errorMessage)
          setUser(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user && !loading) {
      refreshProfile()
    } else if (!user) {
      setUserProfile(null)
      setHasAccess(false)
      setIsAdmin(false)
      setError(null)
    }
  }, [user, loading, refreshProfile])

  const signOut = async () => {
    try {
      setError(null)
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw new Error(`Sign out failed: ${error.message}`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign out'
      setError(errorMessage)
      throw err
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      hasAccess,
      isAdmin,
      isAuthenticated,
      isPendingApproval,
      error,
      signOut,
      refreshProfile,
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}