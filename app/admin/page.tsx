'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AdminMap from '@/components/AdminMap'
import { Users, CheckCircle, AlertCircle, BarChart3, MapPin, Loader, RefreshCw } from 'lucide-react'
import { getAdminDashboard, getAdminRequests, type AdminDashboard, type AdminRequest } from '@/lib/api'

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [recentRequests, setRecentRequests] = useState<AdminRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFamily, setSelectedFamily] = useState<any>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardData, requestsData] = await Promise.all([
        getAdminDashboard(),
        getAdminRequests(undefined, 10),
      ])
      setDashboard(dashboardData)
      setRecentRequests(requestsData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const stats = dashboard?.dashboard
  const errors = dashboard?.error_distribution || []

  const familiesWithLocations = recentRequests
    .filter(r => r.status === 'success' && r.household_name)
    .slice(0, 10)
    .map((r, idx) => ({
      id: String(r.id),
      name: r.household_name || `Gia đình #${r.id}`,
      latitude: 21.0285 + (idx * 0.01),
      longitude: 105.8542 + (idx * 0.01),
      address: r.household_address || 'Chưa có địa chỉ',
      supportNeeds: ['rice', 'water'],
      status: 'verified' as const,
    }))

  if (loading) {
    return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><Loader size={48} className="animate-spin text-primary mx-auto mb-4" /><p className="text-muted-foreground">Đang tải dữ liệu từ server...</p></div></main><Footer /></>)
  }

  if (error) {
    return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center px-4"><div className="text-center max-w-md"><AlertCircle size={48} className="text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold text-foreground mb-2">Lỗi Kết Nối</h2><p className="text-muted-foreground mb-4">{error}</p><p className="text-sm text-muted-foreground mb-6">Đảm bảo backend Django đang chạy tại http://localhost:8000</p><button onClick={fetchData} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition flex items-center gap-2 mx-auto"><RefreshCw size={18} />Thử lại</button></div></main><Footer /></>)
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard Quản Trị</h1>
              <p className="text-muted-foreground">Dữ liệu từ server - cập nhật realtime</p>
            </div>
            <button onClick={fetchData} className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground hover:text-foreground" title="Tải lại"><RefreshCw size={20} /></button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Tổng Yêu Cầu</h3>
                <div className="p-2 bg-primary/10 rounded-lg"><BarChart3 className="text-primary" size={24} /></div>
              </div>
              <p className="text-3xl font-bold text-foreground mb-2">{stats?.total_requests?.toLocaleString() ?? 0}</p>
              <p className="text-sm text-muted-foreground">{stats?.total_pending ?? 0} đang chờ duyệt</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Tỷ Lệ Thành Công</h3>
                <div className="p-2 bg-success/10 rounded-lg"><CheckCircle className="text-success" size={24} /></div>
              </div>
              <p className="text-3xl font-bold text-foreground mb-2">{(stats?.success_rate_percent ?? 0).toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">{stats?.total_success ?? 0} yêu cầu thành công</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Người Dùng</h3>
                <div className="p-2 bg-accent/10 rounded-lg"><Users className="text-accent" size={24} /></div>
              </div>
              <p className="text-3xl font-bold text-foreground mb-2">{stats?.total_active_users ?? 0}</p>
              <p className="text-sm text-muted-foreground">{stats?.total_admins ?? 0} quản trị viên</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Thất Bại</h3>
                <div className="p-2 bg-warning/10 rounded-lg"><AlertCircle className="text-warning" size={24} /></div>
              </div>
              <p className="text-3xl font-bold text-foreground mb-2">{stats?.total_failed ?? 0}</p>
              <p className="text-sm text-muted-foreground">TB: {(stats?.avg_processing_time_ms ?? 0).toFixed(0)}ms</p>
            </div>
          </div>

          {/* Map */}
          {familiesWithLocations.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6 mb-8">
              <div className="flex items-center gap-2 mb-4"><MapPin className="text-primary" size={24} /><h2 className="text-lg font-bold text-foreground">Bản Đồ Phân Bố</h2></div>
              <AdminMap families={familiesWithLocations} onFamilySelect={setSelectedFamily} />
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-foreground mb-6">Chỉ Số AI Pipeline</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2"><span className="text-sm text-foreground">Confidence TB</span><span className="text-sm font-semibold">{((stats?.avg_confidence ?? 0) * 100).toFixed(1)}%</span></div>
                  <div className="w-full bg-secondary rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{ width: `${(stats?.avg_confidence ?? 0) * 100}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2"><span className="text-sm text-foreground">Blur Score TB</span><span className="text-sm font-semibold">{(stats?.avg_blur_score ?? 0).toFixed(0)}</span></div>
                  <div className="w-full bg-secondary rounded-full h-2"><div className="bg-success h-2 rounded-full" style={{ width: `${Math.min(((stats?.avg_blur_score ?? 0) / 500) * 100, 100)}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2"><span className="text-sm text-foreground">Tỷ lệ thành công</span><span className="text-sm font-semibold">{(stats?.success_rate_percent ?? 0).toFixed(1)}%</span></div>
                  <div className="w-full bg-secondary rounded-full h-2"><div className="bg-success h-2 rounded-full" style={{ width: `${stats?.success_rate_percent ?? 0}%` }} /></div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-foreground mb-6">Phân Bố Lỗi</h2>
              {errors.length > 0 ? (
                <div className="space-y-4">
                  {errors.map((err, idx) => {
                    const total = errors.reduce((s, e) => s + e.count, 0)
                    const pct = total > 0 ? (err.count / total) * 100 : 0
                    const labels: Record<string, string> = { blur: 'Ảnh mờ', low_confidence: 'Confidence thấp', invalid: 'Không hợp lệ', wrong_doc: 'Sai tài liệu', forgery: 'Nghi giả mạo', success: 'Thành công' }
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1"><span className="text-sm">{labels[err.result_type] || err.result_type}</span><span className="text-sm font-semibold">{err.count} ({pct.toFixed(1)}%)</span></div>
                        <div className="w-full bg-secondary rounded-full h-2"><div className="bg-gradient-to-r from-primary to-accent h-2 rounded-full" style={{ width: `${pct}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              ) : (<p className="text-muted-foreground text-sm">Chưa có dữ liệu lỗi</p>)}
            </div>
          </div>

          {/* Recent Requests */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">Yêu Cầu Gần Đây</h2>
              <Link href="/admin/review" className="text-primary hover:underline text-sm">Xem tất cả →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Mã XM</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Loại</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Confidence</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Trạng Thái</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Thời Gian</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.length > 0 ? recentRequests.map((req) => (
                    <tr key={req.id} className="border-b border-border hover:bg-secondary/30 transition">
                      <td className="px-4 py-3 text-sm">#{req.id}</td>
                      <td className="px-4 py-3 text-sm font-mono">{req.verification_code || '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {req.predicted_class === 'so_ho_ngheo' ? 'Sổ hộ nghèo' : req.predicted_class === 'giay_to_khac' ? 'Giấy tờ khác' : req.predicted_class === 'anh_khong_lien_quan' ? 'Không liên quan' : req.predicted_class || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">{req.confidence ? `${(req.confidence * 100).toFixed(1)}%` : '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${req.status === 'success' ? 'bg-success/10 text-success' : req.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                          {req.status === 'success' ? 'Thành công' : req.status === 'pending' ? 'Chờ duyệt' : 'Thất bại'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{req.processing_time_ms ? `${req.processing_time_ms}ms` : '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Chưa có yêu cầu nào</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}