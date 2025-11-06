import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Create Supabase client - only create if configured, otherwise throw error
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables are not set. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database types
export type UserRole = 'teacher' | 'student'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  full_name?: string
  created_at?: string
}

