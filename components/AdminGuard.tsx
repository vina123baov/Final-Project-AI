'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { Loader, ShieldAlert } from 'lucide-react'

interface AdminGuardProps {
  children: React.ReactNode
  requireSuperAdmin?: boolean
}

export default function AdminGuard({ children, requireSuperAdmin = false }: AdminGuardProps) {
  const { user, profile, loading, isAdmin } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    // Chưa login → về /login
    if (!user) {
      router.replace('/login')
      return
    }

    // Đã login nhưng profile chưa load xong - đợi
    if (!profile) return

    // Không phải admin → về /
    if (!isAdmin) {
      router.replace('/')
      return
    }

    // Cần super_admin nhưng chỉ là admin
    if (requireSuperAdmin && profile.role !== 'super_admin') {
      router.replace('/admin')
    }
  }, [user, profile, loading, isAdmin, pathname, router, requireSuperAdmin])

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader size={48} className="animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-400">Đang xác thực admin...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) return null

  if (requireSuperAdmin && profile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <ShieldAlert size={64} className="text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Không có quyền truy cập</h2>
          <p className="text-muted-foreground mb-6">Trang này chỉ dành cho Super Admin</p>
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