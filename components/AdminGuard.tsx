'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAdminAuth } from '@/components/AdminAuthContext'
import { Loader, ShieldAlert } from 'lucide-react'

interface AdminGuardProps {
  children: React.ReactNode
  requireSuperAdmin?: boolean
}

export default function AdminGuard({ children, requireSuperAdmin = false }: AdminGuardProps) {
  const { admin, loading } = useAdminAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (loading) return

    // Trang login: nếu đã login thì vào /admin
    if (isLoginPage) {
      if (admin) router.replace('/admin')
      return
    }

    // Trang admin khác: chưa login thì về /admin/login
    if (!admin) {
      router.replace('/admin/login')
      return
    }

    // Kiểm tra quyền super_admin
    if (requireSuperAdmin && admin.role !== 'super_admin') {
      router.replace('/admin')
    }
  }, [admin, loading, pathname, router, isLoginPage, requireSuperAdmin])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader size={48} className="animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-400">Đang xác thực...</p>
        </div>
      </div>
    )
  }

  // Trang login luôn hiển thị
  if (isLoginPage) return <>{children}</>

  // Chưa login - không render (đang redirect)
  if (!admin) return null

  // Cần super_admin nhưng không phải
  if (requireSuperAdmin && admin.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <ShieldAlert size={64} className="text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Không có quyền truy cập</h2>
          <p className="text-muted-foreground mb-6">
            Trang này chỉ dành cho Super Admin
          </p>
          <button
            onClick={() => router.replace('/admin')}
            className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg"
          >
            Quay lại Admin Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}