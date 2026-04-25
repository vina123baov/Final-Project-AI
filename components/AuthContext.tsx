'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: 'user' | 'admin' | 'super_admin'
  is_active: boolean
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
})

const STORAGE_KEY = 'sb-pshspnvomfkxhrymetyf-auth-token'

function readSessionFromStorage(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.expires_at && parsed.expires_at * 1000 < Date.now()) {
      console.warn('[Auth] Session expired')
      return null
    }
    return parsed as Session
  } catch (err) {
    console.error('[Auth] Failed to read session:', err)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  const loadProfile = async (userId: string) => {
    try {
      console.log('[Auth] Loading profile for:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('[Auth] Profile error:', error.message)
        return null
      }
      if (!data) {
        console.warn('[Auth] No profile found')
        return null
      }
      console.log('[Auth] Profile loaded - role:', data.role)
      return data as UserProfile
    } catch (err) {
      console.error('[Auth] Profile fetch failed:', err)
      return null
    }
  }

  useEffect(() => {
    let mounted = true
    console.log('[Auth] Init')

    const initialSession = readSessionFromStorage()
    console.log('[Auth] Initial session:', initialSession?.user?.email || 'null')

    if (initialSession?.user) {
      setSession(initialSession)
      setUser(initialSession.user)

      loadProfile(initialSession.user.id).then(p => {
        if (mounted) setProfile(p)
      })
    }

    setLoading(false)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return
        console.log('[Auth] Event:', event, '→', newSession?.user?.email || 'null')

        setSession(newSession)
        setUser(newSession?.user || null)

        if (newSession?.user) {
          const p = await loadProfile(newSession.user.id)
          if (mounted) setProfile(p)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  // FIX Lỗi 2: signOut không bị treo
  const signOut = async () => {
    console.log('[Auth] Signing out')

    // BƯỚC 1: Xóa localStorage NGAY (đồng bộ, không thể fail)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
        // Xóa cả các key Supabase khác phòng hờ
        Object.keys(window.localStorage)
          .filter(k => k.startsWith('sb-'))
          .forEach(k => window.localStorage.removeItem(k))
      } catch (err) {
        console.error('[Auth] Clear localStorage error:', err)
      }
    }

    // BƯỚC 2: Reset state ngay
    setUser(null)
    setSession(null)
    setProfile(null)

    // BƯỚC 3: Gọi supabase signOut với timeout 2s (không chờ nếu treo)
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('signOut timeout')), 2000))
      ])
    } catch (err) {
      console.warn('[Auth] supabase.signOut() timeout/failed:', err)
      // Không sao - đã xóa localStorage rồi
    }

    console.log('[Auth] Signed out, redirecting...')
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}