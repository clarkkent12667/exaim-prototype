import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, UserRole } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function SignupForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { signUp, getDashboardRoute, user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const signUpAttempted = useRef(false)

  // Handle navigation after successful sign-up and profile is loaded
  useEffect(() => {
    if (signUpAttempted.current && !authLoading && !loading && user && profile) {
      const dashboardRoute = getDashboardRoute()
      if (dashboardRoute && dashboardRoute !== '/auth') {
        signUpAttempted.current = false
        navigate(dashboardRoute, { replace: true })
      }
    }
  }, [user, profile, authLoading, loading, navigate, getDashboardRoute])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    signUpAttempted.current = true

    const { error } = await signUp(email, password, role, fullName)

    if (error) {
      setError(error.message || 'Failed to create account')
      setLoading(false)
      signUpAttempted.current = false
    } else {
      // Check if we have a session (email confirmation disabled) or need to wait
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (session) {
        // Session exists - profile should be loaded by signUp, useEffect will handle navigation
        setLoading(false)
      } else {
        // Email confirmation required
        setSuccess(true)
        setLoading(false)
        signUpAttempted.current = false
      }
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>We've sent you a confirmation link</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please check your email and click the confirmation link to verify your account.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={onSwitchToLogin} className="w-full" variant="outline">
            Back to Sign In
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Sign up to get started</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
            />
          </div>
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
              minLength={6}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">I am a</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
              required
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

