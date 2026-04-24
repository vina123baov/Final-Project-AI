'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Menu, X, ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/app/utils/supabase/client'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email || null
      setUserEmail(email)

      // Kiểm tra admin dựa theo email hoặc metadata
      if (email) {
        const role = session?.user?.user_metadata?.role
        const adminEmails = ['vothaibao50@gmail.com'] // thêm email admin tại đây
        setIsAdmin(role === 'admin' || adminEmails.includes(email))
      }
    }
    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email || null
      setUserEmail(email)
      if (email) {
        const role = session?.user?.user_metadata?.role
        const adminEmails = ['vothaibao50@gmail.com']
        setIsAdmin(role === 'admin' || adminEmails.includes(email))
      } else {
        setIsAdmin(false)
      }
    })

    return () => { subscription.unsubscribe() }
  }, [])

  // Lấy số lượng pending + review cần duyệt
  useEffect(() => {
    if (!isAdmin) return

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const fetchPending = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/requests/?limit=200`)
        if (!res.ok) return
        const data = await res.json()
        const count = (data.data || []).filter(
          (r: any) => r.status === 'pending' || r.status === 'review'
        ).length
        setPendingCount(count)
      } catch {
        // silent fail
      }
    }

    fetchPending()
    const interval = setInterval(fetchPending, 300000) 
    return () => clearInterval(interval)
  }, [isAdmin])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUserEmail(null)
    setIsAdmin(false)
    setPendingCount(0)
    router.replace('/login')
  }

  const isActive = (href: string) =>
    pathname === href ? 'text-primary font-semibold' : 'text-foreground hover:text-primary'

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold group-hover:shadow-lg transition-all">VF</div>
          <span className="text-2xl font-bold bg-gradient-text hidden md:inline">VerifyFamily</span>
        </Link>

        {/* Desktop nav */}
        {userEmail && (
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className={`px-3 py-2 rounded-lg transition font-medium ${isActive('/')}`}>
              Trang chủ
            </Link>
            <Link href="/verify" className={`px-3 py-2 rounded-lg transition font-medium ${isActive('/verify')}`}>
              Xác minh
            </Link>
            <Link href="/history" className={`px-3 py-2 rounded-lg transition font-medium ${isActive('/history')}`}>
              Lịch sử
            </Link>

            {/* Admin dropdown */}
            {isAdmin && (
              <div className="relative group">
                <button className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition font-medium ${pathname.startsWith('/admin') ? 'text-primary font-semibold' : 'text-foreground hover:text-primary'}`}>
                  Quản trị
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50 group-hover:opacity-100 transition-transform group-hover:rotate-180 duration-200">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Dropdown menu */}
                <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                  <div className="p-1">
                    <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition text-sm font-medium text-foreground">
                      <span className="text-base">📊</span>
                      Dashboard
                    </Link>

                    {/* Review — nổi bật nhất */}
                    <Link
                      href="/admin/review"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-warning/10 transition text-sm font-medium text-foreground group/item"
                    >
                      <span className="text-base">🔍</span>
                      <span className="flex-1">Xét duyệt thủ công</span>
                      {pendingCount > 0 && (
                        <span className="px-2 py-0.5 bg-warning text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                      )}
                    </Link>

                    <Link href="/admin/statistics" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition text-sm font-medium text-foreground">
                      <span className="text-base">📈</span>
                      Thống kê
                    </Link>
                    <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition text-sm font-medium text-foreground">
                      <span className="text-base">👥</span>
                      Người dùng
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Non-admin: vẫn thấy Quản trị nhưng không có dropdown review */}
            {!isAdmin && (
              <Link href="/admin" className={`px-3 py-2 rounded-lg transition font-medium ${isActive('/admin')}`}>
                Quản trị
              </Link>
            )}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {userEmail ? (
            <>
              {/* Admin badge + review shortcut (desktop) */}
              {isAdmin && pendingCount > 0 && (
                <Link
                  href="/admin/review"
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/30 text-warning rounded-lg text-sm font-semibold hover:bg-warning/20 transition"
                  title="Có hồ sơ chờ xét duyệt"
                >
                  <ShieldCheck size={16} />
                  {pendingCount} chờ duyệt
                </Link>
              )}

              <span className="hidden md:block text-sm text-muted-foreground truncate max-w-[160px]">{userEmail}</span>
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:shadow-md transition font-medium"
              >
                <LogOut size={18} />Đăng xuất
              </button>
            </>
          ) : (
            <Link href="/login" className="hidden md:flex px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium">
              Đăng nhập
            </Link>
          )}

          {/* Mobile hamburger */}
          {userEmail && (
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 hover:bg-secondary rounded-lg">
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && userEmail && (
        <nav className="md:hidden border-t border-border bg-background p-4 space-y-1">
          <Link href="/" className="block px-3 py-2.5 rounded-lg text-foreground hover:bg-secondary font-medium" onClick={() => setIsMenuOpen(false)}>
            Trang chủ
          </Link>
          <Link href="/verify" className="block px-3 py-2.5 rounded-lg text-foreground hover:bg-secondary font-medium" onClick={() => setIsMenuOpen(false)}>
            Xác minh
          </Link>
          <Link href="/history" className="block px-3 py-2.5 rounded-lg text-foreground hover:bg-secondary font-medium" onClick={() => setIsMenuOpen(false)}>
            Lịch sử
          </Link>

          {/* Admin section mobile */}
          <div className="pt-2 border-t border-border">
            <p className="px-3 py-1 text-xs text-muted-foreground font-semibold uppercase tracking-wide">Quản trị</p>
            <Link href="/admin" className="block px-3 py-2.5 rounded-lg text-foreground hover:bg-secondary font-medium" onClick={() => setIsMenuOpen(false)}>
              📊 Dashboard
            </Link>

            {/* Xét duyệt — nổi bật */}
            <Link
              href="/admin/review"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-warning/10 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="text-foreground">🔍 Xét duyệt thủ công</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-warning text-white text-xs font-bold rounded-full">
                  {pendingCount}
                </span>
              )}
            </Link>

            <Link href="/admin/statistics" className="block px-3 py-2.5 rounded-lg text-foreground hover:bg-secondary font-medium" onClick={() => setIsMenuOpen(false)}>
              📈 Thống kê
            </Link>
            <Link href="/admin/users" className="block px-3 py-2.5 rounded-lg text-foreground hover:bg-secondary font-medium" onClick={() => setIsMenuOpen(false)}>
              👥 Người dùng
            </Link>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground px-3 py-1 truncate">{userEmail}</p>
            <button
              onClick={handleLogout}
              className="w-full mt-1 px-4 py-2.5 rounded-lg bg-secondary hover:bg-muted transition text-foreground flex items-center gap-2 justify-center font-medium"
            >
              <LogOut size={18} />Đăng xuất
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}