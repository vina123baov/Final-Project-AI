'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Toast, { ToastType } from '@/components/Toast'
import { Search, Lock, Unlock, Loader, RefreshCw, AlertCircle } from 'lucide-react'
import { getAdminUsers, toggleUserActive, type UserProfile } from '@/lib/api'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true); setError(null)
    try {
      const data = await getAdminUsers()
      setUsers(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối server')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    setTogglingId(userId)
    try {
      await toggleUserActive(userId, !currentActive)
      setToast({ message: currentActive ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản', type: 'success' })
      fetchUsers()
    } catch (err) {
      setToast({ message: 'Lỗi khi cập nhật', type: 'error' })
    } finally { setTogglingId(null) }
  }

  const filteredUsers = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.phone || '').includes(searchTerm)
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader size={48} className="animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Đang tải danh sách người dùng...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <AlertCircle size={48} className="text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Lỗi Kết Nối</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button onClick={fetchUsers} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg flex items-center gap-2 mx-auto">
          <RefreshCw size={18} />Thử lại
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Quản Lý Người Dùng</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchUsers} className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground"><RefreshCw size={18} /></button>
            <Link href="/admin" className="text-primary hover:underline text-sm">← Quay lại</Link>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-muted-foreground" size={20} />
            <input type="text" placeholder="Tìm kiếm theo tên, email hoặc số điện thoại..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Họ và tên</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">SĐT</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Vai trò</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Ngày Tham Gia</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Xác Minh</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Trạng Thái</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-border hover:bg-secondary/30 transition">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{user.full_name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{user.phone || '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground'}`}>
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString('vi-VN')}</td>
                    <td className="px-6 py-4 text-sm text-foreground">{user.verification_count}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.is_active ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {user.is_active ? 'Hoạt động' : 'Bị khóa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        disabled={togglingId === user.id}
                        className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground hover:text-foreground disabled:opacity-50"
                        title={user.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                      >
                        {togglingId === user.id ? <Loader size={16} className="animate-spin" /> : user.is_active ? <Lock size={16} /> : <Unlock size={16} />}
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">{searchTerm ? 'Không tìm thấy người dùng' : 'Chưa có người dùng nào'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-card border border-border rounded-lg p-6"><p className="text-sm text-muted-foreground mb-2">Tổng Người Dùng</p><p className="text-3xl font-bold text-foreground">{users.length}</p></div>
          <div className="bg-card border border-border rounded-lg p-6"><p className="text-sm text-muted-foreground mb-2">Đang Hoạt Động</p><p className="text-3xl font-bold text-foreground">{users.filter(u => u.is_active).length}</p></div>
          <div className="bg-card border border-border rounded-lg p-6"><p className="text-sm text-muted-foreground mb-2">Tổng Xác Minh</p><p className="text-3xl font-bold text-foreground">{users.reduce((s, u) => s + u.verification_count, 0)}</p></div>
        </div>
      </div>
      {toast && <div className="fixed bottom-4 right-4 z-50"><Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /></div>}
    </div>
  )
}