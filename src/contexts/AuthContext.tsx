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

  const isAuthenticated = !!user
  const isPendingApproval = !!userProfile && userProfile.role === 'pending'

  const updateUserProfile = useCallback(async (user: AuthUser | null) => {
    if (!user) {
      setUserProfile(null)
      setHasAccess(false)
      setIsAdmin(false)
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
        setHasAccess(profile ? profile.role !== 'pending' : false)
        setIsAdmin(profile ? profile.role === 'admin' : false)
      }
    } catch (err) {
      console.error('Error updating user profile:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user profile'
      setError(errorMessage)
      setUserProfile(null)
      setHasAccess(false)
      setIsAdmin(false)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await updateUserProfile(user)
    }
  }, [user, updateUserProfile])

  useEffect(() => {
    updateUserProfile(user)
  }, [user, updateUserProfile])

  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      console.log('[AuthContext] Getting initial user...')
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
          console.warn('[AuthContext] Failed to get user:', error.message)
          // Don't throw error for missing session - this is normal for unauthenticated users
          setUser(null)
        } else {
          console.log('[AuthContext] User retrieved:', { id: user?.id, email: user?.email })
          setUser(user)
        }
      } catch (error) {
        console.warn('[AuthContext] Error getting user:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state change:', event, {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          sessionAccessToken: !!session?.access_token,
          sessionRefreshToken: !!session?.refresh_token
        })
        try {
          // Clear previous errors when auth state changes
          setError(null)
          setUser(session?.user ?? null)
          setLoading(false)
        } catch (error) {
          console.error('[AuthContext] Error in auth state change:', error)
          setUser(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    try {
      setError(null)
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Clear state
      setUser(null)
      setUserProfile(null)
      setHasAccess(false)
      setIsAdmin(false)
    } catch (err) {
      console.error('Error signing out:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign out'
      setError(errorMessage)
      throw err
    }
  }

  const clearError = () => {
    setError(null)
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
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}