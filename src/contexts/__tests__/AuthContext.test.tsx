import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { supabase } from '@/lib/supabase'
import { ReactNode } from 'react'

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  describe('useAuth', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')

      consoleSpy.mockRestore()
    })
  })

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const mockUser = {
        id: 'user1',
        email: 'test@example.com',
      }

      const mockSession = {
        user: mockUser,
        access_token: 'token',
      }

      const mockProfile = {
        id: 'user1',
        email: 'test@example.com',
        role: 'teacher' as const,
        full_name: 'Test User',
      }

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any)

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      } as any)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(async () => {
        const signInResult = await result.current.signIn('test@example.com', 'password')
        expect(signInResult.error).toBeNull()
      })
    })

    it('should handle sign in error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any)

      const mockError = { message: 'Invalid credentials' }
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(async () => {
        const signInResult = await result.current.signIn('test@example.com', 'wrongpassword')
        expect(signInResult.error).toEqual(mockError)
      })
    })
  })

  describe('signUp', () => {
    it('should sign up user successfully', async () => {
      const mockUser = {
        id: 'user1',
        email: 'newuser@example.com',
      }

      const mockSession = {
        user: mockUser,
        access_token: 'token',
      }

      const mockProfile = {
        id: 'user1',
        email: 'newuser@example.com',
        role: 'student' as const,
        full_name: 'New User',
      }

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any)

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn()
              .mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' },
              })
              .mockResolvedValueOnce({
                data: mockProfile,
                error: null,
              }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(async () => {
        const signUpResult = await result.current.signUp(
          'newuser@example.com',
          'password',
          'student',
          'New User'
        )
        expect(signUpResult.error).toBeNull()
      }, { timeout: 3000 })
    })

    it('should handle sign up error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any)

      const mockError = { message: 'Email already exists' }
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(async () => {
        const signUpResult = await result.current.signUp(
          'existing@example.com',
          'password',
          'teacher'
        )
        expect(signUpResult.error).toEqual(mockError)
      })
    })
  })

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any)

      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(async () => {
        await result.current.signOut()
        expect(supabase.auth.signOut).toHaveBeenCalled()
      })
    })
  })

  describe('getDashboardRoute', () => {
    it('should return teacher dashboard route for teacher', async () => {
      const mockUser = {
        id: 'user1',
        email: 'teacher@example.com',
      }

      const mockSession = {
        user: mockUser,
        access_token: 'token',
      }

      const mockProfile = {
        id: 'user1',
        email: 'teacher@example.com',
        role: 'teacher' as const,
        full_name: 'Teacher',
      }

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any)

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      } as any)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.profile).toBeDefined()
      })

      const route = result.current.getDashboardRoute()
      expect(route).toBe('/teacher/dashboard')
    })

    it('should return student dashboard route for student', async () => {
      const mockUser = {
        id: 'user1',
        email: 'student@example.com',
      }

      const mockSession = {
        user: mockUser,
        access_token: 'token',
      }

      const mockProfile = {
        id: 'user1',
        email: 'student@example.com',
        role: 'student' as const,
        full_name: 'Student',
      }

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any)

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      } as any)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.profile).toBeDefined()
      })

      const route = result.current.getDashboardRoute()
      expect(route).toBe('/student/dashboard')
    })

    it('should return auth route when no profile', () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any)

      const { result } = renderHook(() => useAuth(), { wrapper })

      const route = result.current.getDashboardRoute()
      expect(route).toBe('/auth')
    })
  })
})

