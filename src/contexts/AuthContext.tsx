import { createContext, useContext, useEffect, useState, useRef, ReactNode, useMemo, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserRole, UserProfile } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, role: UserRole, fullName?: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  getDashboardRoute: () => string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const currentUserIdRef = useRef<string | null>(null)

  // Memoize fetchUserProfile to prevent recreation on every render
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      // Reduced timeout - 2 seconds is enough for profile fetch
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout after 2 seconds')), 2000)
      )

      const { data, error } = await Promise.race([
        queryPromise.then(({ data, error }) => ({ data, error })),
        timeoutPromise
      ]) as { data: any, error: any }

      if (error) {
        // If profile doesn't exist (PGRST116), that's okay - user might need to sign up again
        setProfile(null)
      } else {
        setProfile(data as UserProfile)
      }
    } catch (error: any) {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Reduced timeout to prevent long loading - 2 seconds is enough
    const timeout = setTimeout(() => {
      if (mounted) {
        setLoading(false)
      }
    }, 2000) // 2 second timeout

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeout)
        if (!mounted) return
        
        if (error) {
          setLoading(false)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)
        currentUserIdRef.current = session?.user?.id ?? null
        
        if (session?.user) {
          fetchUserProfile(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch(() => {
        clearTimeout(timeout)
        if (mounted) {
          setLoading(false)
        }
      })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      
      const newUserId = session?.user?.id ?? null
      
      // Only update state if there's an actual change to prevent unnecessary re-renders
      if (newUserId !== currentUserIdRef.current) {
        currentUserIdRef.current = newUserId
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchUserProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [fetchUserProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setLoading(false)
        return { error }
      }

      if (data.user) {
        // Wait for profile to be fetched before returning
        await fetchUserProfile(data.user.id)
        // Profile fetch will set loading to false in finally block
      } else {
        setLoading(false)
      }

      return { error: null }
    } catch (error: any) {
      setLoading(false)
      return { error: error || new Error('Sign in failed') }
    }
  }, [fetchUserProfile])

  const signUp = useCallback(async (email: string, password: string, role: UserRole, fullName?: string) => {
    try {
      setLoading(true)
      
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            full_name: fullName || null,
          },
        },
      })

      if (authError) {
        setLoading(false)
        return { error: authError }
      }

      if (!data.user) {
        setLoading(false)
        return { error: new Error('User creation failed') }
      }

      // Wait a moment for the database trigger to create the profile
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Fetch the profile
      await fetchUserProfile(data.user.id)
      
      // Check if profile was created by reading it directly
      const { data: profileData, error: profileCheckError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      
      if (profileCheckError || !profileData) {
        try {
          // Try inserting directly first (bypass RLS with a service role call)
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: email,
              role: role,
              full_name: fullName || null
            })
          
          if (insertError) {
            // Fallback to RPC if direct insert fails
            const { error: createError } = await supabase.rpc('create_user_profile', {
              user_id: data.user.id,
              user_email: email,
              user_role: role,
              user_full_name: fullName || null
            })
            
            if (!createError) {
              await fetchUserProfile(data.user.id)
            }
          } else {
            await fetchUserProfile(data.user.id)
          }
        } catch (rpcError) {
          // Profile creation exception
        }
      }

      return { error: null }
    } catch (error: any) {
      setLoading(false)
      return { error: error || new Error('Signup failed') }
    }
  }, [fetchUserProfile])

  const signOut = useCallback(async () => {
    try {
      setProfile(null)
      setUser(null)
      setSession(null)
      await supabase.auth.signOut()
    } catch (error) {
      // Error signing out
    }
  }, [])

  // Memoize getDashboardRoute to prevent recreation
  const getDashboardRoute = useCallback((): string => {
    // If no profile, redirect to auth
    if (!profile) return '/auth'
    // Return role-specific dashboard
    return profile.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'
  }, [profile])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    getDashboardRoute,
  }), [user, profile, session, loading, signIn, signUp, signOut, getDashboardRoute])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

