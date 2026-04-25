'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { Loader } from 'lucide-react'

const PUBLIC_PATHS = ['/login', '/register']

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, profile, loading, isAdmin } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isAdminRoute = pathname.startsWith('/admin')

  useEffect(() => {
    if (loading) return

    // Admin route: để AdminGuard xử lý
    if (isAdminRoute) return

    if (user) {
      // Đã login + đang ở /login hoặc /register
      if (PUBLIC_PATHS.includes(pathname)) {
        // Nếu là admin → vào /admin, nếu không → /
        if (isAdmin) {
          router.replace('/admin')
        } else {
          router.replace('/')
        }
      }
    } else {
      // Chưa login + không phải public path → về /login
      if (!PUBLIC_PATHS.includes(pathname)) {
        router.replace('/login')
      }
    }
  }, [user, profile, loading, isAdmin, pathname, router, isAdminRoute])

  // Trang admin: render thẳng, để AdminGuard handle
  if (isAdminRoute) {
    return <>{children}</>
  }

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

  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}