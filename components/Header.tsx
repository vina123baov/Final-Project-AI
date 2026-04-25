'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const pathname = usePathname()

  const { user, signOut } = useAuth()
  const userEmail = user?.email || null

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut()
    } catch (err) {
      console.error('Logout error:', err)
    }
    // Force reload trang về /login (không dùng router)
    window.location.replace('/login')
  }

  const isActive = (href: string) =>
    pathname === href ? 'text-primary font-semibold' : 'text-foreground hover:text-primary'

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold group-hover:shadow-lg transition-all">VF</div>
          <span className="text-2xl font-bold bg-gradient-text hidden md:inline">VerifyFamily</span>
        </Link>

        {userEmail && (
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className={`px-3 py-2 rounded-lg transition font-medium ${isActive('/')}`}>Trang chủ</Link>
            <Link href="/verify" className={`px-3 py-2 rounded-lg transition font-medium ${isActive('/verify')}`}>Xác minh</Link>
            <Link href="/history" className={`px-3 py-2 rounded-lg transition font-medium ${isActive('/history')}`}>Lịch sử</Link>
          </nav>
        )}

        <div className="flex items-center gap-3">
          {userEmail ? (
            <>
              <span className="hidden md:block text-sm text-muted-foreground truncate max-w-[160px]">{userEmail}</span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:shadow-md transition font-medium disabled:opacity-50"
              >
                <LogOut size={18} />
                {isLoggingOut ? 'Đang...' : 'Đăng xuất'}
              </button>
            </>
          ) : (
            <Link href="/login" className="hidden md:flex px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium">
              Đăng nhập
            </Link>
          )}

          {userEmail && (
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 hover:bg-secondary rounded-lg">
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
        </div>
      </div>

      {isMenuOpen && userEmail && (
        <nav className="md:hidden border-t border-border bg-background p-4 space-y-1">
          <Link href="/" className="block px-3 py-2.5 rounded-lg text-foreground hover:bg-secondary font-medium" onClick={() => setIsMenuOpen(false)}>Trang chủ</Link>
          <Link href="/verify" className="block px-3 py-2.5 rounded-lg text-foreground hover:bg-secondary font-medium" onClick={() => setIsMenuOpen(false)}>Xác minh</Link>
          <Link href="/history" className="block px-3 py-2.5 rounded-lg text-foreground hover:bg-secondary font-medium" onClick={() => setIsMenuOpen(false)}>Lịch sử</Link>

          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground px-3 py-1 truncate">{userEmail}</p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full mt-1 px-4 py-2.5 rounded-lg bg-secondary hover:bg-muted transition text-foreground flex items-center gap-2 justify-center font-medium disabled:opacity-50"
            >
              <LogOut size={18} />
              {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}