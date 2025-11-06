import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, session, loading, getDashboardRoute } = useAuth()

  if (loading) {
    return (
      <Layout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  // Redirect if not authenticated
  if (!user || !session) {
    return <Navigate to="/auth" replace />
  }

  // Check role-based access - but only redirect if profile exists and doesn't match
  // If profile is null but user exists, wait a bit (might be loading)
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect to user's appropriate dashboard instead of showing access denied
    const dashboardRoute = getDashboardRoute()
    return <Navigate to={dashboardRoute} replace />
  }

  // If user exists but profile is still loading, show layout with loading state
  // This prevents unnecessary redirects during profile fetch
  if (user && !profile) {
    return (
      <Layout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading profile...</div>
        </div>
      </Layout>
    )
  }

  return <Layout>{children}</Layout>
}

