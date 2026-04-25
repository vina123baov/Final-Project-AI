import { createClient as supabaseCreateClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pshspnvomfkxhrymetyf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaHNwbnZvbWZreGhyeW1ldHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODI5MTQsImV4cCI6MjA4OTc1ODkxNH0.aPEFkO-vyJqPOc0G1EFJN2gYv0jkkyFHhspJrsyogu8'

let supabaseInstance: SupabaseClient | null = null

export const createClient = (): SupabaseClient => {
  // Server-side render
  if (typeof window === 'undefined') {
    return supabaseCreateClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  // Client-side singleton
  if (!supabaseInstance) {
    supabaseInstance = supabaseCreateClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-pshspnvomfkxhrymetyf-auth-token',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        // FIX: Tắt NavigatorLockManager - nguyên nhân gây timeout 5s
        // Lock này gây deadlock trong nhiều trường hợp (đa tab, refresh, Brave incognito)
        lock: async (_name, _acquireTimeout, fn) => {
          return await fn()
        },
      },
    })
  }

  return supabaseInstance
}