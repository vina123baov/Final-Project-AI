'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Search, Lock, Unlock, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface User {
  id: string
  name: string
  email: string
  phone: string
  joinDate: string
  isActive: boolean
  verificationCount: number
}

export default function AdminUsersPage() {
  const [users] = useState<User[]>([
    {
      id: '1',
      name: 'Nguyễn Văn A',
      email: 'vana@example.com',
      phone: '+84 908 123 456',
      joinDate: '2024-01-15',
      isActive: true,
      verificationCount: 24,
    },
    {
      id: '2',
      name: 'Trần Thị B',
      email: 'thib@example.com',
      phone: '+84 909 234 567',
      joinDate: '2024-01-20',
      isActive: true,
      verificationCount: 18,
    },
    {
      id: '3',
      name: 'Lê Văn C',
      email: 'vanc@example.com',
      phone: '+84 910 345 678',
      joinDate: '2024-02-01',
      isActive: false,
      verificationCount: 5,
    },
    {
      id: '4',
      name: 'Phạm Thị D',
      email: 'thid@example.com',
      phone: '+84 911 456 789',
      joinDate: '2024-02-05',
      isActive: true,
      verificationCount: 42,
    },
    {
      id: '5',
      name: 'Hoàng Văn E',
      email: 'vane@example.com',
      phone: '+84 912 567 890',
      joinDate: '2024-02-08',
      isActive: true,
      verificationCount: 12,
    },
  ])

  const [searchTerm, setSearchTerm] = useState('')

  const filteredUsers = users.filter(
    user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm)
  )

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-4xl font-bold text-foreground">Quản Lý Người Dùng</h1>
                <p className="text-muted-foreground">Quản lý tài khoản người dùng hệ thống</p>
              </div>
              <Link href="/admin" className="text-primary hover:underline text-sm">
                ← Quay lại
              </Link>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-card border border-border rounded-lg p-4 mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên, email hoặc số điện thoại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Họ và tên</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">SĐT</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Ngày Tham Gia</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Lần Xác Minh</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Trạng Thái</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border hover:bg-secondary/30 transition">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{user.name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{user.phone}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{user.joinDate}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{user.verificationCount}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            user.isActive ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                          }`}
                        >
                          {user.isActive ? 'Hoạt động' : 'Khóa'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground hover:text-foreground"
                            title={user.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          >
                            {user.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                          </button>
                          <button
                            className="p-2 hover:bg-destructive/10 rounded-lg transition text-muted-foreground hover:text-destructive"
                            title="Xóa tài khoản"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">Tổng Người Dùng</p>
              <p className="text-3xl font-bold text-foreground">{users.length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">Người Dùng Hoạt Động</p>
              <p className="text-3xl font-bold text-foreground">{users.filter(u => u.isActive).length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">Tổng Xác Minh</p>
              <p className="text-3xl font-bold text-foreground">{users.reduce((sum, u) => sum + u.verificationCount, 0)}</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
