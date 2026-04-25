'use client'

import React from "react"
import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Toast, { ToastType } from '@/components/Toast'
import { Mail, Lock } from 'lucide-react'
import { createClient } from '@/app/utils/supabase/client'

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password) {
      setToast({ message: 'Vui lòng nhập email và mật khẩu', type: 'error' })
      return
    }

    setIsLoading(true)
    try {
      // BƯỚC 1: Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        setToast({
          message: error.message === 'Invalid login credentials'
            ? 'Email hoặc mật khẩu không đúng'
            : error.message,
          type: 'error'
        })
        setIsLoading(false)
        return
      }

      if (!data.session || !data.user) {
        setToast({ message: 'Đăng nhập thất bại', type: 'error' })
        setIsLoading(false)
        return
      }

      // BƯỚC 2: Query role NGAY trước khi redirect
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Profile query error:', profileError)
        setToast({ message: 'Lỗi khi lấy thông tin tài khoản', type: 'error' })
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      if (!profileData) {
        setToast({ message: 'Không tìm thấy thông tin tài khoản', type: 'error' })
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      if (!profileData.is_active) {
        setToast({ message: 'Tài khoản đã bị vô hiệu hóa', type: 'error' })
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      // BƯỚC 3: Redirect THẲNG bằng window.location (không qua router/AuthGuard)
      // Force reload để AuthContext tự đọc lại session từ localStorage
      const targetPath =
        profileData.role === 'admin' || profileData.role === 'super_admin'
          ? '/admin'
          : '/'

      console.log('[Login] Redirecting to:', targetPath, '(role:', profileData.role, ')')

      // Dùng location.replace để tránh giữ /login trong history
      window.location.replace(targetPath)
    } catch (error) {
      console.error('Login error:', error)
      setToast({ message: 'Lỗi đăng nhập. Vui lòng thử lại.', type: 'error' })
      setIsLoading(false)
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-xl border border-border p-8 shadow-lg">
            <h1 className="text-3xl font-bold text-foreground text-center mb-2">Đăng Nhập</h1>
            <p className="text-center text-muted-foreground mb-8">Đăng nhập để sử dụng hệ thống xác minh</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="email" name="email"
                    value={formData.email} onChange={handleChange}
                    placeholder="Nhập email" required disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Mật khẩu</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="password" name="password"
                    value={formData.password} onChange={handleChange}
                    placeholder="Nhập mật khẩu" required disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit" disabled={isLoading}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50 mt-6"
              >
                {isLoading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">hoặc</span>
              </div>
            </div>

            <p className="text-center text-muted-foreground">
              Chưa có tài khoản?{' '}
              <Link href="/register" className="text-primary font-semibold hover:underline">Đăng ký ngay</Link>
            </p>
          </div>
        </div>
      </main>
      {toast && <div className="fixed bottom-4 right-4 z-50"><Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /></div>}
      <Footer />
    </>
  )
}