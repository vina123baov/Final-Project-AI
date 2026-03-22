'use client'

import Link from 'next/link'
import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold group-hover:shadow-lg transition-all">
            VF
          </div>
          <span className="text-2xl font-bold bg-gradient-text hidden md:inline">VerifyFamily</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link href="/" className="px-3 py-2 text-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition font-medium">
            Trang chủ
          </Link>
          <Link href="/verify" className="px-3 py-2 text-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition font-medium">
            Xác minh
          </Link>
          <Link href="/history" className="px-3 py-2 text-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition font-medium">
            Lịch sử
          </Link>
          <Link href="/admin" className="px-3 py-2 text-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition font-medium">
            Quản trị
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <button className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground hover:shadow-md transition font-medium">
            <LogOut size={18} />
            Đăng xuất
          </button>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 hover:bg-secondary rounded-lg"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <nav className="md:hidden border-t border-border bg-background p-4 space-y-3">
          <Link href="/" className="block py-2 text-foreground hover:text-primary">
            Trang chủ
          </Link>
          <Link href="/verify" className="block py-2 text-foreground hover:text-primary">
            Xác minh
          </Link>
          <Link href="/history" className="block py-2 text-foreground hover:text-primary">
            Lịch sử
          </Link>
          <Link href="/admin" className="block py-2 text-foreground hover:text-primary">
            Quản trị
          </Link>
          <button className="w-full mt-2 px-4 py-2 rounded-lg bg-secondary hover:bg-muted transition text-foreground flex items-center gap-2 justify-center">
            <LogOut size={18} />
            Đăng xuất
          </button>
        </nav>
      )}
    </header>
  )
}
