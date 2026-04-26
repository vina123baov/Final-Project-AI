'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Loader, AlertCircle, RefreshCw, Clock } from 'lucide-react'
import { createClient } from '@/app/utils/supabase/client'
import { getHistory, type HistoryRecord } from '@/lib/api'

const LOCAL_CACHE_KEY = 'verifyfamily-history-cache'
const LOCAL_CACHE_TTL_MS = 5 * 60 * 1000  // 5 phut

type LocalCache = {
  userId: string
  records: HistoryRecord[]
  cachedAt: number
}

function readLocalCache(userId: string): HistoryRecord[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY)
    if (!raw) return null
    const parsed: LocalCache = JSON.parse(raw)
    if (parsed.userId !== userId) return null
    if (Date.now() - parsed.cachedAt > LOCAL_CACHE_TTL_MS) return null
    return parsed.records
  } catch {
    return null
  }
}

function writeLocalCache(userId: string, records: HistoryRecord[]) {
  if (typeof window === 'undefined') return
  try {
    const data: LocalCache = { userId, records, cachedAt: Date.now() }
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data))
  } catch {
    // Quota full hoac private mode → skip
  }
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [supabase] = useState(() => createClient())

  /**
   * Strategy: stale-while-revalidate
   * 1. Hien thi local cache ngay (instant)
   * 2. Background fetch data moi
   * 3. Update UI khi co data moi
   * 4. Neu fetch fail nhung co cache cu → giu cache + show warning
   */
  const loadHistory = async (uid: string, isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      // Lan dau: thu doc cache local truoc
      const cached = readLocalCache(uid)
      if (cached && cached.length > 0) {
        setRecords(cached)
        setLoading(false)
        // Background fetch fresh data
      } else {
        setLoading(true)
      }
    }

    setWarning(null)
    setError(null)

    try {
      const response = await getHistory(uid, 30)

      // Backend co the tra ve _error neu khong fetch duoc tu Supabase
      if (response._error && response.data.length === 0) {
        // Khong co data tu API + khong co cache local → show error
        const cached = readLocalCache(uid)
        if (cached && cached.length > 0) {
          setRecords(cached)
          setWarning('Đang hiển thị dữ liệu đã lưu. Mạng có vấn đề, hãy thử lại sau.')
        } else {
          setError('Mạng đang chậm, không tải được dữ liệu. Vui lòng thử lại.')
        }
        return
      }

      // Backend tra ve stale cache → van dung duoc nhung warn user
      if (response._stale) {
        setWarning('Dữ liệu có thể chưa cập nhật mới nhất.')
      }

      setRecords(response.data)
      writeLocalCache(uid, response.data)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('History fetch error:', msg)

      // Timeout → fallback sang local cache
      const cached = readLocalCache(uid)
      if (cached && cached.length > 0) {
        setRecords(cached)
        setWarning('Mạng chậm — đang hiển thị dữ liệu đã lưu (tối đa 5 phút trước).')
      } else if (msg === 'TIMEOUT') {
        setError('Server phản hồi chậm. Vui lòng thử lại sau ít phút.')
      } else {
        setError('Không thể tải lịch sử. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        await loadHistory(user.id, false)
      } else {
        setError('Vui lòng đăng nhập để xem lịch sử')
        setLoading(false)
      }
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
      case 'review': return 'bg-blue-500/10 text-blue-600'
      default: return 'bg-destructive/10 text-destructive'
    }
  }
  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return 'Thành công'
      case 'pending': return 'Chờ duyệt'
      case 'review': return 'Cần xem xét'
      default: return 'Thất bại'
    }
  }

  // Loading lan dau (chua co cache)
  if (loading && records.length === 0 && !error) return (
    <>
      <Header />
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader size={48} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải lịch sử...</p>
          <p className="text-xs text-muted-foreground mt-2 opacity-70">Lần đầu có thể mất 10-20 giây</p>
        </div>
      </main>
      <Footer />
    </>
  )

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Lịch Sử Xác Minh</h1>
              <p className="text-muted-foreground">
                {records.length > 0 ? `${records.length} kết quả gần nhất` : 'Chưa có dữ liệu'}
              </p>
            </div>
            {userId && (
              <button
                onClick={() => loadHistory(userId, true)}
                disabled={refreshing}
                className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground hover:text-foreground disabled:opacity-50"
                title="Tải lại"
              >
                <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
              </button>
            )}
          </div>

          {/* Warning banner — data cu nhung van hien thi */}
          {warning && records.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-6 flex items-start gap-3">
              <Clock size={18} className="text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-foreground">{warning}</p>
              </div>
              {userId && (
                <button
                  onClick={() => loadHistory(userId, true)}
                  disabled={refreshing}
                  className="text-xs text-warning hover:underline font-medium whitespace-nowrap"
                >
                  {refreshing ? 'Đang tải...' : 'Thử lại'}
                </button>
              )}
            </div>
          )}

          {/* Error: khong co data va khong co cache */}
          {error && records.length === 0 && userId && (
            <div className="text-center py-16">
              <AlertCircle size={48} className="text-destructive mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Không tải được lịch sử</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">{error}</p>
              <button
                onClick={() => userId && loadHistory(userId, true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Đang tải...' : 'Thử lại'}
              </button>
            </div>
          )}

          {/* Chua login */}
          {error && !userId && (
            <div className="text-center py-16">
              <AlertCircle size={48} className="text-warning mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Chưa đăng nhập</h3>
              <p className="text-muted-foreground mb-6">Vui lòng đăng nhập để xem lịch sử</p>
              <Link href="/login" className="inline-block px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90">
                Đăng Nhập
              </Link>
            </div>
          )}

          {/* Co data — hien thi bang */}
          {records.length > 0 && (
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

          {/* Empty state — login OK, fetch OK, nhung khong co data */}
          {!error && !loading && records.length === 0 && userId && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-foreground mb-2">Chưa có lịch sử</h3>
              <p className="text-muted-foreground mb-6">Bạn chưa xác minh tài liệu nào</p>
              <Link href="/verify" className="inline-block px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90">Bắt Đầu Xác Minh</Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}