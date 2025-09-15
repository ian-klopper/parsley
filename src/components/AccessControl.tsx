'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface AccessControlProps {
  children: React.ReactNode
  requireRole?: 'user' | 'admin'
  fallback?: React.ReactNode
}

export function AccessControl({ children, requireRole, fallback }: AccessControlProps) {
  const { user, userProfile, loading, hasAccess, isAdmin } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 bg-gradient-to-r from-primary via-primary/50 to-transparent"></div>
      </div>
    )
  }

  if (!user) {
    router.push('/')
    return null
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Your user profile could not be loaded. Please try refreshing or contact support.
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (userProfile.role === 'pending') {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Account Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Your account is pending approval from an administrator. 
              You will receive access once your account has been reviewed.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => router.push('/')}
              >
                Back to Login
              </Button>
              <Button 
                onClick={() => window.location.reload()}
              >
                Check Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (requireRole === 'admin' && !isAdmin) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              You don&apos;t have permission to access this page. Admin privileges are required.
            </p>
            <Button onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (requireRole === 'user' && !hasAccess) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              You don&apos;t have permission to access this page.
            </p>
            <Button onClick={() => router.push('/')}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

// Higher-order component for page-level protection
export function withAuth<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  requireRole?: 'user' | 'admin'
) {
  const AuthenticatedComponent = (props: T) => {
    return (
      <AccessControl requireRole={requireRole}>
        <Component {...props} />
      </AccessControl>
    )
  }

  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`
  
  return AuthenticatedComponent
}