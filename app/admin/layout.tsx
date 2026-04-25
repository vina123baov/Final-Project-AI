'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAdminAuth, AdminAuthProvider } from '@/components/AdminAuthContext'
import AdminGuard from '@/components/AdminGuard'
import {
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  Users,
  LogOut,
  Shield,
  ChevronRight,
} from 'lucide-react'

// ============================================================
// Layout này chỉ áp dụng cho các trang trong /admin/*
// HOÀN TOÀN tách biệt với layout của user thường
// ============================================================

function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { admin, logout } = useAdminAuth()

  const handleLogout = async () => {
    await logout()
    router.replace('/admin/login')
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/review', label: 'Xét duyệt', icon: ShieldCheck },
    { href: '/admin/statistics', label: 'Thống kê', icon: BarChart3 },
    { href: '/admin/users', label: 'Người dùng', icon: Users },
  ]

  if (!admin) return null

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col border-r border-slate-800">

      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <Link href="/admin" className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition">
            <Shield size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-bold text-white leading-tight">VerifyFamily</p>
            <p className="text-xs text-emerald-400 leading-tight">Admin Panel</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition group ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-emerald-400' : ''} />
              <span className="flex-1 text-sm">{item.label}</span>
              {isActive && <ChevronRight size={16} className="text-emerald-400" />}
            </Link>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-slate-800">
        <div className="px-3 py-2.5 mb-2 rounded-lg bg-slate-800/50">
          <p className="text-xs text-slate-500 mb-0.5">Đang đăng nhập</p>
          <p className="text-sm font-semibold text-white truncate">{admin.full_name}</p>
          <p className="text-xs text-slate-400 truncate">{admin.email}</p>
          <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-medium ${
            admin.role === 'super_admin'
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            {admin.role === 'super_admin' ? '⭐ Super Admin' : '🛡️ Admin'}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition text-sm font-medium"
        >
          <LogOut size={18} />
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/admin/login'

  // Trang login KHÔNG hiển thị sidebar
  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminGuard>
        <AdminLayoutInner>
          {children}
        </AdminLayoutInner>
      </AdminGuard>
    </AdminAuthProvider>
  )
}