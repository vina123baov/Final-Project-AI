'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const TOKEN_KEY = 'vf_admin_token'

// ============================================================
// AdminAuthContext - HOÀN TOÀN TÁCH BIỆT với AuthContext (user)
//
// Khác biệt:
// - User: dùng Supabase Auth
// - Admin: dùng custom auth qua bảng admins + token (Django backend)
// ============================================================

export interface Admin {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'super_admin'
}

interface AdminAuthContextValue {
  admin: Admin | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  getToken: () => string | null
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  admin: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  getToken: () => null,
})

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)

  // Verify token khi load app
  useEffect(() => {
    const verifyToken = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

      if (!token) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_BASE}/api/admin/verify/`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const data = await res.json()
          if (data.valid && data.admin) {
            setAdmin(data.admin)
          } else {
            localStorage.removeItem(TOKEN_KEY)
          }
        } else {
          localStorage.removeItem(TOKEN_KEY)
        }
      } catch (err) {
        console.error('Admin verify error:', err)
        localStorage.removeItem(TOKEN_KEY)
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (data.success && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token)
        setAdmin(data.admin)
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Đăng nhập thất bại' }
      }
    } catch (err) {
      return { success: false, error: 'Lỗi kết nối server' }
    }
  }

  const logout = async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      try {
        await fetch(`${API_BASE}/api/admin/logout/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        console.error('Admin logout error:', err)
      }
    }
    localStorage.removeItem(TOKEN_KEY)
    setAdmin(null)
  }

  const getToken = () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  }

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout, getToken }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  return useContext(AdminAuthContext)
}