import { createClient as supabaseCreateClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pshspnvomfkxhrymetyf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaHNwbnZvbWZreGhyeW1ldHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODI5MTQsImV4cCI6MjA4OTc1ODkxNH0.aPEFkO-vyJqPOc0G1EFJN2gYv0jkkyFHhspJrsyogu8'

let supabaseInstance: SupabaseClient | null = null

export const createClient = (): SupabaseClient => {
  // Server-side render (SSR) - mỗi request tạo client mới
  if (typeof window === 'undefined') {
    return supabaseCreateClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  // Client-side - dùng singleton
  if (!supabaseInstance) {
    supabaseInstance = supabaseCreateClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-pshspnvomfkxhrymetyf-auth-token',
      },
    })
  }

  return supabaseInstance
}