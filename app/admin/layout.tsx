'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
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

function AdminSidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut()
    } catch (err) {
      console.error('Logout error:', err)
    }
    window.location.replace('/login')
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/review', label: 'Xét duyệt', icon: ShieldCheck },
    { href: '/admin/statistics', label: 'Thống kê', icon: BarChart3 },
    { href: '/admin/users', label: 'Người dùng', icon: Users },
  ]

  if (!profile) return null

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col border-r border-slate-800">
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

      <div className="p-3 border-t border-slate-800">
        <div className="px-3 py-2.5 mb-2 rounded-lg bg-slate-800/50">
          <p className="text-xs text-slate-500 mb-0.5">Đang đăng nhập</p>
          <p className="text-sm font-semibold text-white truncate">{profile.full_name || 'Admin'}</p>
          <p className="text-xs text-slate-400 truncate">{profile.email}</p>
          <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-medium ${
            profile.role === 'super_admin'
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            {profile.role === 'super_admin' ? '⭐ Super Admin' : '🛡️ Admin'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition text-sm font-medium disabled:opacity-50"
        >
          <LogOut size={18} />
          {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
        </button>
      </div>
    </aside>
  )
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
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
    <AdminGuard>
      <AdminLayoutInner>
        {children}
      </AdminLayoutInner>
    </AdminGuard>
  )
}