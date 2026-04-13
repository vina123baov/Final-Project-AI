'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { BarChart3, PieChart, TrendingUp, Loader, RefreshCw, AlertCircle } from 'lucide-react'
import { getAdminDashboard, type AdminDashboard } from '@/lib/api'

export default function AdminStatisticsPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true); setError(null)
    try { setDashboard(await getAdminDashboard()) }
    catch (err) { setError(err instanceof Error ? err.message : 'Không thể kết nối server') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const stats = dashboard?.dashboard
  const errors = dashboard?.error_distribution || []
  const totalErrors = errors.reduce((s, e) => s + e.count, 0)

  if (loading) return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><Loader size={48} className="animate-spin text-primary mx-auto mb-4" /><p className="text-muted-foreground">Đang tải thống kê...</p></div></main><Footer /></>)
  if (error) return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center px-4"><div className="text-center max-w-md"><AlertCircle size={48} className="text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold text-foreground mb-2">Lỗi Kết Nối</h2><p className="text-muted-foreground mb-6">{error}</p><button onClick={fetchData} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg flex items-center gap-2 mx-auto"><RefreshCw size={18} />Thử lại</button></div></main><Footer /></>)

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div><h1 className="text-4xl font-bold text-foreground">Thống Kê Chi Tiết</h1><p className="text-muted-foreground">Dữ liệu thực từ GET /api/admin/dashboard/</p></div>
            <div className="flex items-center gap-2">
              <button onClick={fetchData} className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground"><RefreshCw size={18} /></button>
              <Link href="/admin" className="text-primary hover:underline text-sm">← Quay lại</Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-card border border-border rounded-xl p-6"><p className="text-muted-foreground text-sm mb-2">Tổng Yêu Cầu</p><p className="text-3xl font-bold text-foreground">{stats?.total_requests ?? 0}</p><p className="text-sm text-muted-foreground">Thành công: {stats?.total_success ?? 0} | Thất bại: {stats?.total_failed ?? 0}</p></div>
            <div className="bg-card border border-border rounded-xl p-6"><p className="text-muted-foreground text-sm mb-2">Thời Gian Xử Lý TB</p><p className="text-3xl font-bold text-foreground">{((stats?.avg_processing_time_ms ?? 0) / 1000).toFixed(1)}s</p><p className="text-sm text-muted-foreground">{(stats?.avg_processing_time_ms ?? 0).toFixed(0)}ms</p></div>
            <div className="bg-card border border-border rounded-xl p-6"><p className="text-muted-foreground text-sm mb-2">Confidence TB</p><p className="text-3xl font-bold text-foreground">{((stats?.avg_confidence ?? 0) * 100).toFixed(1)}%</p><p className="text-sm text-muted-foreground">Blur TB: {(stats?.avg_blur_score ?? 0).toFixed(0)}</p></div>
            <div className="bg-card border border-border rounded-xl p-6"><p className="text-muted-foreground text-sm mb-2">Người Dùng</p><p className="text-3xl font-bold text-foreground">{stats?.total_active_users ?? 0}</p><p className="text-sm text-muted-foreground">Admin: {stats?.total_admins ?? 0}</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2"><BarChart3 size={20} />Tỷ Lệ Thành Công</h2>
              <div className="space-y-4">
                <div><div className="flex justify-between mb-2"><span className="text-sm">Thành công</span><span className="text-sm font-semibold">{stats?.total_success ?? 0} ({(stats?.success_rate_percent ?? 0).toFixed(1)}%)</span></div><div className="w-full bg-secondary rounded-full h-3"><div className="bg-success h-3 rounded-full" style={{ width: `${stats?.success_rate_percent ?? 0}%` }} /></div></div>
                <div><div className="flex justify-between mb-2"><span className="text-sm">Thất bại</span><span className="text-sm font-semibold">{stats?.total_failed ?? 0}</span></div><div className="w-full bg-secondary rounded-full h-3"><div className="bg-destructive h-3 rounded-full" style={{ width: `${100 - (stats?.success_rate_percent ?? 0)}%` }} /></div></div>
                <div><div className="flex justify-between mb-2"><span className="text-sm">Chờ duyệt</span><span className="text-sm font-semibold">{stats?.total_pending ?? 0}</span></div><div className="w-full bg-secondary rounded-full h-3"><div className="bg-warning h-3 rounded-full" style={{ width: `${(stats?.total_requests ?? 0) > 0 ? ((stats?.total_pending ?? 0) / (stats?.total_requests ?? 1)) * 100 : 0}%` }} /></div></div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2"><PieChart size={20} />Phân Bố Kết Quả Pipeline</h2>
              {errors.length > 0 ? (
                <div className="space-y-4">
                  {errors.map((err, idx) => {
                    const pct = totalErrors > 0 ? (err.count / totalErrors) * 100 : 0
                    const labels: Record<string, string> = { blur: 'Ảnh mờ', low_confidence: 'Confidence thấp', invalid: 'Không hợp lệ', wrong_doc: 'Sai tài liệu', forgery: 'Nghi giả mạo', success: 'Thành công', review: 'Cần duyệt' }
                    return (<div key={idx}><div className="flex justify-between mb-1"><span className="text-sm">{labels[err.result_type] || err.result_type}</span><span className="text-sm font-semibold">{err.count} ({pct.toFixed(1)}%)</span></div><div className="w-full bg-secondary rounded-full h-3"><div className="bg-gradient-to-r from-primary to-accent h-3 rounded-full" style={{ width: `${pct}%` }} /></div></div>)
                  })}
                </div>
              ) : (<p className="text-muted-foreground text-sm">Chưa có dữ liệu</p>)}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2"><TrendingUp size={20} />Chỉ Số Pipeline AI</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-1">Confidence TB</p><p className="font-semibold">{((stats?.avg_confidence ?? 0) * 100).toFixed(2)}%</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-1">Blur Score TB</p><p className="font-semibold">{(stats?.avg_blur_score ?? 0).toFixed(1)}</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-1">Xử Lý TB</p><p className="font-semibold">{(stats?.avg_processing_time_ms ?? 0).toFixed(0)}ms</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-1">Tỷ Lệ Thành Công</p><p className="font-semibold">{(stats?.success_rate_percent ?? 0).toFixed(2)}%</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-1">Tổng Người Dùng</p><p className="font-semibold">{stats?.total_active_users ?? 0}</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-1">Tổng Admin</p><p className="font-semibold">{stats?.total_admins ?? 0}</p></div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}