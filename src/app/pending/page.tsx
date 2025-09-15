'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle2, XCircle, RefreshCw, LogOut } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { PageLayout } from "@/components/PageLayout"

export default function PendingPage() {
  const { user, userProfile, loading, refreshProfile } = useAuth()
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    // If user is approved, redirect to dashboard
    if (userProfile && userProfile.role !== 'pending') {
      router.push('/dashboard')
    }
  }, [userProfile, router])

  const handleCheckStatus = async () => {
    setChecking(true)
    await refreshProfile()
    setChecking(false)
  }

  const handleSignOut = () => {
    router.push('/')
  }

  if (loading) {
    return (
      <PageLayout title="Loading..." showBackButton={true}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-32 w-32 bg-gradient-to-r from-primary via-primary/50 to-transparent"></div>
        </div>
      </PageLayout>
    )
  }

  if (!userProfile || userProfile.role !== 'pending') {
    return null
  }

  return (
    <PageLayout title="Pending Approval" showBackButton={true}>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Clock className="h-16 w-16 text-yellow-500" />
            </div>
            <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
            <CardDescription>
              Welcome, {userProfile.full_name || userProfile.email}!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2">What happens next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500" />
                  <span>Your account has been created successfully</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-yellow-500" />
                  <span>An administrator will review and approve your account</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>Once approved, you'll have full access to the system</span>
                </li>
              </ul>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Account Status</span>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending Approval
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{userProfile.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{userProfile.full_name || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Joined</span>
                  <span>{new Date(userProfile.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCheckStatus}
                disabled={checking}
                className="flex-1"
              >
                {checking ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Status
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Approval typically takes 1-2 business days. If you need immediate access,
              please contact your system administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}