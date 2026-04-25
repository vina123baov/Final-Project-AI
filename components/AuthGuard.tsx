'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { Loader } from 'lucide-react'

// Cac trang KHONG can dang nhap
const PUBLIC_PATHS = ['/login', '/register']

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()  // ← dùng context, không gọi API
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading) return  // chờ auth load xong

    if (user) {
      // Đã login - nếu đang ở trang public thì chuyển về trang chủ
      if (PUBLIC_PATHS.includes(pathname)) {
        router.replace('/')
      }
    } else {
      // Chưa login - nếu không phải trang public thì chuyển về login
      if (!PUBLIC_PATHS.includes(pathname)) {
        router.replace('/login')
      }
    }
  }, [user, loading, pathname, router])

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

  // Trang public (login/register) luôn hiển thị
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>
  }

  // Trang khác: chỉ hiển thị khi đã đăng nhập
  if (!user) {
    return null  // đang redirect về /login
  }

  return <>{children}</>
}