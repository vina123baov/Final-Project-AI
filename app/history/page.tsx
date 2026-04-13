'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CheckCircle, AlertTriangle, Loader, AlertCircle } from 'lucide-react'
import { createClient } from '@/app/utils/supabase/client'
import { getHistory, type HistoryRecord } from '@/lib/api'

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        try {
          const data = await getHistory(user.id, 100)
          setRecords(data.data)
        } catch (err) { setError(err instanceof Error ? err.message : 'Không thể kết nối server') }
      } else { setError('Vui lòng đăng nhập để xem lịch sử') }
      setLoading(false)
    }
    init()
  }, [supabase])

  const totalPages = Math.ceil(records.length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const paginatedRecords = records.slice(startIdx, startIdx + itemsPerPage)

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'success': return 'bg-success/10 text-success'
      case 'pending': return 'bg-warning/10 text-warning'
      default: return 'bg-destructive/10 text-destructive'
    }
  }
  const getStatusText = (status: string) => {
    switch (status) { case 'success': return 'Thành công'; case 'pending': return 'Chờ duyệt'; default: return 'Thất bại' }
  }

  if (loading) return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><Loader size={48} className="animate-spin text-primary mx-auto mb-4" /><p className="text-muted-foreground">Đang tải lịch sử...</p></div></main><Footer /></>)

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Lịch Sử Xác Minh</h1>
            <p className="text-muted-foreground">{error ? error : `${records.length} kết quả từ server`}</p>
          </div>

          {!error && records.length > 0 && (
            <>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary/50 border-b border-border">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Ngày</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Mã XM</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Loại</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Trạng Thái</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Confidence</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Kết Quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((r) => (
                        <tr key={r.id} className="border-b border-border hover:bg-secondary/30 transition">
                          <td className="px-6 py-4 text-sm">{new Date(r.created_at).toLocaleDateString('vi-VN')}</td>
                          <td className="px-6 py-4 text-sm font-mono">{r.verification_code || '—'}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {r.result_type === 'success' ? 'Sổ hộ nghèo' : r.result_type === 'blur' ? 'Ảnh mờ' : r.result_type === 'wrong_doc' ? 'Sai tài liệu' : r.result_type || '—'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBg(r.status)}`}>{getStatusText(r.status)}</span>
                          </td>
                          <td className="px-6 py-4 text-sm">{r.confidence ? `${(r.confidence * 100).toFixed(1)}%` : '—'}</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground truncate max-w-[200px]">{r.result_message || r.message || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Hiển thị {startIdx + 1}-{Math.min(startIdx + itemsPerPage, records.length)} / {records.length}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 text-foreground">Trước</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button key={page} onClick={() => setCurrentPage(page)} className={`px-4 py-2 rounded-lg ${currentPage === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary text-foreground'}`}>{page}</button>
                    ))}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 text-foreground">Sau</button>
                  </div>
                </div>
              )}
            </>
          )}

          {!error && records.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-foreground mb-2">Chưa có lịch sử</h3>
              <p className="text-muted-foreground mb-6">Bạn chưa xác minh tài liệu nào</p>
              <Link href="/verify" className="inline-block px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90">Bắt Đầu Xác Minh</Link>
            </div>
          )}

          {error && !userId && (
            <div className="text-center py-16">
              <AlertCircle size={48} className="text-warning mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Chưa đăng nhập</h3>
              <p className="text-muted-foreground mb-6">Vui lòng đăng nhập để xem lịch sử</p>
              <Link href="/login" className="inline-block px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90">Đăng Nhập</Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}