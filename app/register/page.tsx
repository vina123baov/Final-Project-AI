'use client'

import React from "react"

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Toast, { ToastType } from '@/components/Toast'
import { Mail, Phone, Lock, User } from 'lucide-react'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setToast({ message: 'Mật khẩu không khớp', type: 'error' })
      return
    }

    if (formData.password.length < 6) {
      setToast({ message: 'Mật khẩu phải có ít nhất 6 ký tự', type: 'error' })
      return
    }

    setIsLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      setToast({ message: 'Đăng ký thành công! Vui lòng đăng nhập.', type: 'success' })
      setFormData({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' })
    } catch (error) {
      setToast({ message: 'Lỗi đăng ký. Vui lòng thử lại.', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-xl border border-border p-8 shadow-lg">
            <h1 className="text-3xl font-bold text-foreground text-center mb-2">Đăng Ký</h1>
            <p className="text-center text-muted-foreground mb-8">Tạo tài khoản mới để xác minh sổ hộ nghèo</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Họ và tên</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Nhập họ và tên"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Nhập email"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Số điện thoại</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Nhập số điện thoại"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Mật khẩu</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Nhập mật khẩu"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Xác nhận mật khẩu</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Xác nhận mật khẩu"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50 mt-6"
              >
                {isLoading ? 'Đang xử lý...' : 'Đăng Ký'}
              </button>
            </form>

            <p className="text-center text-muted-foreground mt-6">
              Đã có tài khoản?{' '}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
      <Footer />
    </>
  )
}
