'use client'

import { useAuth } from '@/contexts/AuthContext'

export function DevBanner() {
  // Only show in development bypass mode
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS !== 'true') {
    return null
  }

  const { userProfile, isAdmin } = useAuth()
  const isDevAdmin = process.env.NEXT_PUBLIC_DEV_ADMIN === 'true'

  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 text-center text-sm font-medium shadow-lg">
      <div className="flex items-center justify-center gap-2">
        <span className="animate-pulse">🚀</span>
        <span>DEV MODE - AUTH BYPASSED</span>
        <span className="mx-2">|</span>
        <span>User: {userProfile?.full_name || 'Development Supreme User'}</span>
        <span className="mx-2">|</span>
        <span className={`font-bold ${isDevAdmin ? 'text-yellow-300' : 'text-green-300'}`}>
          {isDevAdmin ? '👑 ADMIN POWERS' : '⭐ USER ACCESS'}
        </span>
        <span className="animate-pulse">🚀</span>
      </div>
    </div>
  )
}