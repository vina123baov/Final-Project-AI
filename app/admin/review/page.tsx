'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Toast, { ToastType } from '@/components/Toast'
import { CheckCircle, XCircle, ChevronDown, Loader, RefreshCw, AlertCircle } from 'lucide-react'
import { getAdminRequests, adminReview, type AdminRequest } from '@/lib/api'

export default function AdminReviewPage() {
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')

  const fetchRequests = async () => {
    setLoading(true); setError(null)
    try {
      const data = await getAdminRequests(filterStatus || undefined, 50)
      setRequests(data.data)
    } catch (err) { setError(err instanceof Error ? err.message : 'Không thể kết nối server') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchRequests() }, [filterStatus])

  const handleApprove = async (id: number) => {
    setReviewingId(id)
    try { await adminReview(id, 'admin-user', 'Đã phê duyệt'); setToast({ message: `#${id} đã phê duyệt`, type: 'success' }); setExpandedId(null); fetchRequests() }
    catch { setToast({ message: 'Lỗi khi phê duyệt', type: 'error' }) }
    finally { setReviewingId(null) }
  }

  const handleReject = async (id: number) => {
    setReviewingId(id)
    try { await adminReview(id, 'admin-user', 'Đã từ chối'); setToast({ message: `#${id} đã từ chối`, type: 'warning' }); setExpandedId(null); fetchRequests() }
    catch { setToast({ message: 'Lỗi khi từ chối', type: 'error' }) }
    finally { setReviewingId(null) }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  if (loading) return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><Loader size={48} className="animate-spin text-primary mx-auto mb-4" /><p className="text-muted-foreground">Đang tải...</p></div></main><Footer /></>)
  if (error) return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center px-4"><div className="text-center max-w-md"><AlertCircle size={48} className="text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold text-foreground mb-2">Lỗi Kết Nối</h2><p className="text-muted-foreground mb-6">{error}</p><button onClick={fetchRequests} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg flex items-center gap-2 mx-auto"><RefreshCw size={18} />Thử lại</button></div></main><Footer /></>)

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div><h1 className="text-4xl font-bold text-foreground">Duyệt Yêu Cầu</h1><p className="text-muted-foreground">Dữ liệu thực từ backend Django</p></div>
            <div className="flex items-center gap-2">
              <button onClick={fetchRequests} className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground"><RefreshCw size={18} /></button>
              <Link href="/admin" className="text-primary hover:underline text-sm">← Quay lại</Link>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {[{ value: '', label: 'Tất cả' }, { value: 'pending', label: 'Chờ duyệt' }, { value: 'success', label: 'Thành công' }, { value: 'failed', label: 'Thất bại' }].map(opt => (
                <button key={opt.value} onClick={() => setFilterStatus(opt.value)} className={`px-4 py-2 rounded-lg transition text-sm ${filterStatus === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-muted text-foreground'}`}>{opt.label}</button>
              ))}
            </div>
          </div>

          {pendingCount > 0 && (<div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6"><p className="text-sm font-medium text-warning">{pendingCount} yêu cầu đang chờ duyệt</p></div>)}

          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === req.id ? null : req.id)} className="w-full p-6 hover:bg-secondary/30 transition flex items-center justify-between">
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-foreground mb-2">#{req.id} — {req.verification_code || 'N/A'}</h3>
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-muted-foreground">{new Date(req.created_at).toLocaleString('vi-VN')}</span>
                      {req.confidence !== null && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${(req.confidence || 0) >= 0.9 ? 'bg-success/10 text-success' : (req.confidence || 0) >= 0.7 ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                          {((req.confidence || 0) * 100).toFixed(1)}%
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${req.status === 'pending' ? 'bg-warning/10 text-warning' : req.status === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {req.status === 'pending' ? 'Chờ duyệt' : req.status === 'success' ? 'Thành công' : 'Thất bại'}
                      </span>
                      {req.result_type && <span className="px-2 py-1 rounded text-xs bg-secondary text-foreground">{req.result_type}</span>}
                    </div>
                  </div>
                  <ChevronDown size={20} className={`text-muted-foreground transition ${expandedId === req.id ? 'rotate-180' : ''}`} />
                </button>

                {expandedId === req.id && (
                  <div className="border-t border-border p-6 space-y-6 bg-secondary/10">
                    <div>
                      <h4 className="font-semibold text-foreground mb-4">Kết Quả AI Pipeline</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Predicted Class</p><p className="font-semibold">{req.predicted_class === 'so_ho_ngheo' ? 'Sổ hộ nghèo' : req.predicted_class === 'giay_to_khac' ? 'Giấy tờ khác' : req.predicted_class || '—'}</p></div>
                        <div className="bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Blur Score</p><p className="font-semibold">{req.blur_score?.toFixed(1) ?? '—'}</p></div>
                        <div className="bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Stamp</p><p className="font-semibold">{req.stamp_detected ? `Có (${(req.stamp_score * 100).toFixed(0)}%)` : 'Không'}</p></div>
                        <div className="bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Forgery</p><p className="font-semibold">{(req.forgery_score * 100).toFixed(1)}%</p></div>
                        <div className="bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Xử lý</p><p className="font-semibold">{req.processing_time_ms ? `${req.processing_time_ms}ms` : '—'}</p></div>
                        <div className="bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">File</p><p className="font-semibold text-sm truncate">{req.original_filename || '—'}</p></div>
                      </div>
                    </div>

                    {req.extracted_text && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-4">Thông Tin OCR</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {req.household_name && <div className="bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Tên chủ hộ</p><p className="font-semibold">{req.household_name}</p></div>}
                          {req.household_address && <div className="bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Địa chỉ</p><p className="font-semibold">{req.household_address}</p></div>}
                          {req.household_id_number && <div className="bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Mã hộ</p><p className="font-semibold">{req.household_id_number}</p></div>}
                        </div>
                        <div className="mt-4 bg-background rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Raw text</p><p className="text-sm whitespace-pre-wrap">{req.extracted_text}</p></div>
                      </div>
                    )}

                    {req.admin_notes && (<div className="bg-primary/5 border border-primary/20 rounded-lg p-4"><p className="text-sm"><strong>Ghi chú:</strong> {req.admin_notes}</p></div>)}

                    {req.status === 'pending' && (
                      <div className="flex gap-4">
                        <button onClick={() => handleApprove(req.id)} disabled={reviewingId === req.id} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-success text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
                          {reviewingId === req.id ? <Loader size={18} className="animate-spin" /> : <CheckCircle size={20} />} Phê Duyệt
                        </button>
                        <button onClick={() => handleReject(req.id)} disabled={reviewingId === req.id} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-destructive text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
                          {reviewingId === req.id ? <Loader size={18} className="animate-spin" /> : <XCircle size={20} />} Từ Chối
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {requests.length === 0 && (<div className="text-center py-12"><CheckCircle size={48} className="text-success mx-auto mb-4 opacity-50" /><h3 className="text-xl font-bold text-foreground mb-2">Không có yêu cầu</h3><p className="text-muted-foreground">{filterStatus ? `Không có "${filterStatus}"` : 'Chưa có yêu cầu nào'}</p></div>)}
        </div>
      </main>
      {toast && <div className="fixed bottom-4 right-4 z-50"><Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /></div>}
      <Footer />
    </>
  )
}