import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const { user, session, profile, loading, getDashboardRoute } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated with profile
  useEffect(() => {
    if (!loading && user && session && profile) {
      const dashboardRoute = getDashboardRoute()
      if (dashboardRoute && dashboardRoute !== '/auth') {
        navigate(dashboardRoute, { replace: true })
      }
    }
  }, [user, session, profile, loading, navigate, getDashboardRoute])

  // Only show loading during initial auth check, not when there's no user
  if (loading && !user && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // If we have a user but are still loading, show loading screen
  // But also show a message if profile is missing after loading completes
  if (loading && user && session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading your profile...</div>
      </div>
    )
  }

  // If user exists but no profile after loading completes, show error
  if (!loading && user && session && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile Not Found</CardTitle>
            <CardDescription>Your account exists but profile could not be loaded</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This might be a database issue. Please try:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 mb-4">
              <li>Refreshing the page</li>
              <li>Signing out and signing back in</li>
              <li>Checking if the SQL setup was run correctly in Supabase</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()} className="w-full">
              Refresh Page
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {isLogin ? (
        <LoginForm onSwitchToSignup={() => setIsLogin(false)} />
      ) : (
        <SignupForm onSwitchToLogin={() => setIsLogin(true)} />
      )}
    </div>
  )
}

