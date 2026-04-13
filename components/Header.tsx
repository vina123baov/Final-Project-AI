'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/app/utils/supabase/client'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser({ email: session.user.email })
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email })
      } else {
        setUser(null)
      }
    })

    return () => { subscription.unsubscribe() }
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.replace('/login')
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold group-hover:shadow-lg transition-all">
            VF
          </div>
          <span className="text-2xl font-bold bg-gradient-text hidden md:inline">VerifyFamily</span>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className="px-3 py-2 text-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition font-medium">Trang chủ</Link>
            <Link href="/verify" className="px-3 py-2 text-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition font-medium">Xác minh</Link>
            <Link href="/history" className="px-3 py-2 text-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition font-medium">Lịch sử</Link>
            <Link href="/admin" className="px-3 py-2 text-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition font-medium">Quản trị</Link>
          </nav>
        )}

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="hidden md:block text-sm text-muted-foreground">{user.email}</span>
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:shadow-md transition font-medium"
              >
                <LogOut size={18} />
                Đăng xuất
              </button>
            </>
          ) : (
            <Link href="/login" className="hidden md:flex px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium">
              Đăng nhập
            </Link>
          )}

          {user && (
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 hover:bg-secondary rounded-lg">
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
        </div>
      </div>

      {isMenuOpen && user && (
        <nav className="md:hidden border-t border-border bg-background p-4 space-y-3">
          <Link href="/" className="block py-2 text-foreground hover:text-primary" onClick={() => setIsMenuOpen(false)}>Trang chủ</Link>
          <Link href="/verify" className="block py-2 text-foreground hover:text-primary" onClick={() => setIsMenuOpen(false)}>Xác minh</Link>
          <Link href="/history" className="block py-2 text-foreground hover:text-primary" onClick={() => setIsMenuOpen(false)}>Lịch sử</Link>
          <Link href="/admin" className="block py-2 text-foreground hover:text-primary" onClick={() => setIsMenuOpen(false)}>Quản trị</Link>
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
            <button onClick={handleLogout} className="w-full px-4 py-2 rounded-lg bg-secondary hover:bg-muted transition text-foreground flex items-center gap-2 justify-center">
              <LogOut size={18} />Đăng xuất
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}