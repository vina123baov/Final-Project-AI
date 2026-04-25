'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

// ============================================================
// AuthContext — quản lý user state ở 1 chỗ duy nhất cho toàn app
//
// Trước đây: mỗi page (verify, history, header...) đều gọi 
//            supabase.auth.getUser() → race condition
//
// Bây giờ: chỉ AuthProvider gọi 1 lần khi app khởi động
//          + lắng nghe onAuthStateChange
//          → các component khác đọc từ context (không gọi API)
// ============================================================

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    let mounted = true

    // Lấy session ban đầu
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (mounted) {
          setSession(currentSession)
          setUser(currentSession?.user || null)
          setLoading(false)
        }
      } catch (err) {
        // Bỏ qua lỗi NavigatorLockAcquireTimeoutError - không crash app
        console.warn('Auth init error (non-critical):', err)
        if (mounted) setLoading(false)
      }
    }

    initSession()

    // Lắng nghe auth state changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return
        setSession(newSession)
        setUser(newSession?.user || null)
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook để dùng auth state ở bất kỳ component nào
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}