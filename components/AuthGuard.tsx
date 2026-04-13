'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/app/utils/supabase/client'
import { Loader } from 'lucide-react'

// Cac trang KHONG can dang nhap
const PUBLIC_PATHS = ['/login', '/register']

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setAuthenticated(true)
        // Neu dang o trang login/register ma da dang nhap -> chuyen ve trang chu
        if (PUBLIC_PATHS.includes(pathname)) {
          router.replace('/')
        }
      } else {
        setAuthenticated(false)
        // Neu chua dang nhap va khong phai trang public -> chuyen ve login
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.replace('/login')
        }
      }
      setLoading(false)
    }

    checkAuth()

    // Lang nghe thay doi auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setAuthenticated(true)
      } else {
        setAuthenticated(false)
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.replace('/login')
        }
      }
    })

    return () => { subscription.unsubscribe() }
  }, [pathname, router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader size={48} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    )
  }

  // Trang public (login/register) luon hien
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>
  }

  // Trang khac: chi hien khi da dang nhap
  if (!authenticated) {
    return null // Dang redirect ve /login
  }

  return <>{children}</>
}