import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm({ onSwitchToSignup }: { onSwitchToSignup: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn, getDashboardRoute, user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const signInAttempted = useRef(false)

  // Handle navigation after successful sign-in and profile is loaded
  useEffect(() => {
    if (signInAttempted.current && !authLoading && !loading && user && profile) {
      const dashboardRoute = getDashboardRoute()
      if (dashboardRoute && dashboardRoute !== '/auth') {
        signInAttempted.current = false
        navigate(dashboardRoute, { replace: true })
      }
    }
  }, [user, profile, authLoading, loading, navigate, getDashboardRoute])

  // Timeout fallback if profile doesn't load within 3 seconds
  useEffect(() => {
    if (signInAttempted.current && !loading) {
      const timeout = setTimeout(() => {
        if (signInAttempted.current && user && !profile) {
          setError('Profile not found. Please try signing in again or contact support.')
          setLoading(false)
          signInAttempted.current = false
        }
      }, 3000)

      return () => clearTimeout(timeout)
    }
  }, [user, profile, loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    signInAttempted.current = true

    const result = await signIn(email, password)

    if (result.error) {
      setError(result.error.message || 'Failed to sign in')
      setLoading(false)
      signInAttempted.current = false
    } else {
      // Profile should be loaded by signIn, useEffect will handle navigation
      // But set loading to false so useEffect can trigger
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-primary hover:underline"
            >
              Sign up
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

