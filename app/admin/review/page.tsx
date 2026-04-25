'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Toast, { ToastType } from '@/components/Toast'
import { CheckCircle, XCircle, ChevronDown, Loader, RefreshCw, AlertCircle, Clock, Eye, Shield, Search, ZoomIn, X, ImageOff } from 'lucide-react'
import { getAdminRequests, type AdminRequest } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pshspnvomfkxhrymetyf.supabase.co'

// ============================================================
// Component xem ảnh
// ============================================================
function RequestImage({ req }: { req: AdminRequest }) {
  const [zoomed, setZoomed] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [currentSrcIndex, setCurrentSrcIndex] = useState(0)

  const imagePath = (req as any).image_path || (req as any).image_storage_path
  const originalFilename = req.original_filename

  const candidateUrls: string[] = []

  if (originalFilename) {
    candidateUrls.push(`${API_BASE}/media/uploads/${originalFilename}`)
  }

  if (imagePath && imagePath.includes('/')) {
    candidateUrls.push(`${SUPABASE_URL}/storage/v1/object/public/verification-images/${imagePath}`)
  }

  if (imagePath && !imagePath.includes('/') && imagePath !== originalFilename) {
    candidateUrls.push(`${API_BASE}/media/uploads/${imagePath}`)
  }

  const imgSrc = candidateUrls[currentSrcIndex]

  if (!imgSrc || imgError) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-secondary/30 rounded-xl border border-dashed border-border gap-3">
        <ImageOff size={32} className="text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Không tải được ảnh</p>
        {originalFilename && (
          <p className="text-xs text-muted-foreground opacity-60 font-mono truncate max-w-xs">{originalFilename}</p>
        )}
      </div>
    )
  }

  return (
    <>
      <div
        className="relative group rounded-xl overflow-hidden border border-border cursor-zoom-in bg-black/5"
        onClick={() => setZoomed(true)}
      >
        <img
          src={imgSrc}
          alt={`Ảnh xác minh #${req.id}`}
          className="w-full h-64 object-contain bg-secondary/20"
          onError={() => {
            if (currentSrcIndex < candidateUrls.length - 1) {
              setCurrentSrcIndex(currentSrcIndex + 1)
            } else {
              setImgError(true)
            }
          }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition bg-black/70 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold">
            <ZoomIn size={18} /> Phóng to xem
          </div>
        </div>
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-6"
          onClick={() => setZoomed(false)}
        >
          <button
            className="absolute top-5 right-5 bg-white/15 hover:bg-white/30 text-white rounded-full p-2.5 transition"
            onClick={() => setZoomed(false)}
          >
            <X size={22} />
          </button>
          <img
            src={imgSrc}
            alt={`Ảnh xác minh #${req.id}`}
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono">
            {originalFilename || `Hồ sơ #${req.id}`}
          </p>
        </div>
      )}
    </>
  )
}

// ============================================================
// Helper: gọi admin review API
// ============================================================
async function callAdminReview(
  requestId: number,
  action: 'approve' | 'reject',
  notes: string,
  adminId?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/admin/review/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_id: requestId,
      admin_id: adminId || null,
      notes,
      action,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`API ${res.status}: ${errText}`)
  }

  return res.json()
}

const RESULT_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  success: { label: 'Thành công', color: 'text-success', bg: 'bg-success/10' },
  blur: { label: 'Ảnh mờ', color: 'text-destructive', bg: 'bg-destructive/10' },
  review_blur: { label: 'Con dấu/chữ ký mờ', color: 'text-blue-600', bg: 'bg-blue-500/10' },
  review_forgery: { label: 'Nghi ngờ nhẹ', color: 'text-blue-600', bg: 'bg-blue-500/10' },
  pending_forgery: { label: 'Nghi ngờ vừa', color: 'text-warning', bg: 'bg-warning/10' },
  pending_no_stamp: { label: 'Không có con dấu', color: 'text-warning', bg: 'bg-warning/10' },
  pending_low_confidence: { label: 'Confidence thấp', color: 'text-warning', bg: 'bg-warning/10' },
  wrong_doc: { label: 'Sai tài liệu', color: 'text-destructive', bg: 'bg-destructive/10' },
  invalid: { label: 'Ảnh không hợp lệ', color: 'text-destructive', bg: 'bg-destructive/10' },
  low_confidence: { label: 'Confidence thấp', color: 'text-destructive', bg: 'bg-destructive/10' },
  forgery: { label: 'Giả mạo', color: 'text-destructive', bg: 'bg-destructive/10' },
  review: { label: 'Cần xem xét', color: 'text-blue-600', bg: 'bg-blue-500/10' },
}

const REVIEW_GUIDANCE: Record<string, { title: string; checks: string[]; tip: string }> = {
  review_blur: {
    title: '📷 Ảnh mờ vùng con dấu/chữ ký',
    checks: [
      'Kiểm tra xem con dấu có còn đọc được không',
      'Xác nhận chữ ký của cán bộ phường/xã',
      'Số sổ hộ nghèo có rõ không',
      'Thông tin tên, địa chỉ có khớp không',
    ],
    tip: 'Nếu đọc được đủ thông tin cơ bản → Đồng ý. Nếu con dấu hoàn toàn không rõ → Từ chối và yêu cầu chụp lại.',
  },
  review_forgery: {
    title: '🛡️ Nghi ngờ tính xác thực (nhẹ)',
    checks: [
      'So sánh màu sắc con dấu với ảnh thực tế',
      'Kiểm tra font chữ và định dạng',
      'Xem metadata ảnh (thường do chất lượng scan)',
      'Kiểm tra viền và góc của tài liệu',
    ],
    tip: 'Thường là do scan/chụp lại từ bản photocopy hoặc chất lượng camera thấp. Nếu nội dung hợp lệ → Đồng ý.',
  },
  pending_forgery: {
    title: '⚠️ Nghi ngờ chỉnh sửa (vừa)',
    checks: [
      'Kiểm tra kỹ các vùng có dấu hiệu bất thường',
      'So sánh tỷ lệ và kích thước font chữ',
      'Xem xét độ đồng đều của màu mực',
      'Liên hệ cơ quan cấp sổ để xác minh nếu cần',
    ],
    tip: 'Cần thận trọng hơn. Nếu nghi ngờ → Liên hệ trực tiếp người dân yêu cầu đến nộp bản gốc.',
  },
  pending_no_stamp: {
    title: '🔎 Không tìm thấy con dấu',
    checks: [
      'Xem ảnh gốc để tìm con dấu đỏ',
      'Con dấu có thể ở góc dưới phải hoặc cuối trang',
      'Kiểm tra xem ảnh có bị cắt mất góc không',
      'Xác nhận đây có phải sổ hộ nghèo thực không',
    ],
    tip: 'Nếu tìm thấy con dấu khi nhìn kỹ → Đồng ý. Nếu không có con dấu nào → Từ chối.',
  },
  pending_low_confidence: {
    title: '📊 Độ nhận diện biên giới',
    checks: [
      'Xác nhận đây có phải sổ hộ nghèo không',
      'Kiểm tra tiêu đề và format của tài liệu',
      'So sánh với mẫu sổ hộ nghèo chuẩn',
      'Kiểm tra thông tin trích xuất có đúng không',
    ],
    tip: 'AI không chắc chắn. Dùng mắt người để xác nhận loại tài liệu. Nếu đúng là sổ hộ nghèo → Đồng ý.',
  },
}

type TabType = 'all' | 'pending' | 'review' | 'success' | 'failed'

const TAB_CONFIG: Record<TabType, { label: string; icon: React.FC<any>; color: string; filterStatus?: string }> = {
  all: { label: 'Tất cả', icon: Search, color: 'text-foreground' },
  pending: { label: 'Chờ duyệt', icon: Clock, color: 'text-warning', filterStatus: 'pending' },
  review: { label: 'Cần xem xét', icon: Eye, color: 'text-blue-500', filterStatus: 'review' },
  success: { label: 'Thành công', icon: CheckCircle, color: 'text-success', filterStatus: 'success' },
  failed: { label: 'Thất bại', icon: XCircle, color: 'text-destructive', filterStatus: 'failed' },
}

export default function AdminReviewPage() {
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [reviewingAction, setReviewingAction] = useState<'approve' | 'reject' | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('pending')

  const fetchRequests = async () => {
    setLoading(true); setError(null)
    try {
      const data = await getAdminRequests(undefined, 50)
      setRequests(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const handleApprove = async (id: number) => {
    setReviewingId(id)
    setReviewingAction('approve')
    try {
      await callAdminReview(id, 'approve', 'Đã đồng ý sau xem xét thủ công')
      setToast({ message: `#${id} đã được phê duyệt`, type: 'success' })
      setExpandedId(null)
      fetchRequests()
    } catch (err) {
      setToast({ message: 'Lỗi khi phê duyệt: ' + (err instanceof Error ? err.message : ''), type: 'error' })
    } finally {
      setReviewingId(null)
      setReviewingAction(null)
    }
  }

  const handleReject = async (id: number) => {
    setReviewingId(id)
    setReviewingAction('reject')
    try {
      await callAdminReview(id, 'reject', 'Đã từ chối sau xem xét thủ công')
      setToast({ message: `#${id} đã từ chối`, type: 'warning' })
      setExpandedId(null)
      fetchRequests()
    } catch (err) {
      setToast({ message: 'Lỗi khi từ chối: ' + (err instanceof Error ? err.message : ''), type: 'error' })
    } finally {
      setReviewingId(null)
      setReviewingAction(null)
    }
  }

  const filteredRequests = requests.filter(r => {
    const cfg = TAB_CONFIG[activeTab]
    if (!cfg.filterStatus) return true
    return r.status === cfg.filterStatus
  })

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    review: requests.filter(r => r.status === 'review').length,
    success: requests.filter(r => r.status === 'success').length,
    failed: requests.filter(r => r.status === 'failed').length,
  }

  const needsActionCount = counts.pending + counts.review

  if (loading) return (
    <>
      <Header />
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center"><Loader size={48} className="animate-spin text-primary mx-auto mb-4" /><p className="text-muted-foreground">Đang tải...</p></div>
      </main>
      <Footer />
    </>
  )

  if (error) return (
    <>
      <Header />
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Lỗi Kết Nối</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button onClick={fetchRequests} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg flex items-center gap-2 mx-auto"><RefreshCw size={18} />Thử lại</button>
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
              <h1 className="text-4xl font-bold text-foreground">Duyệt Yêu Cầu</h1>
              <p className="text-muted-foreground">Dữ liệu thực từ backend Django</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchRequests} className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground"><RefreshCw size={18} /></button>
              <Link href="/admin" className="text-primary hover:underline text-sm">← Quay lại</Link>
            </div>
          </div>

          {needsActionCount > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6 flex items-center gap-3">
              <Clock size={20} className="text-warning flex-shrink-0" />
              <p className="text-sm font-medium text-warning">
                {needsActionCount} hồ sơ cần xét duyệt —
                {counts.pending > 0 && ` ${counts.pending} chờ duyệt`}
                {counts.pending > 0 && counts.review > 0 && ','}
                {counts.review > 0 && ` ${counts.review} cần xem xét`}
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-1 mb-6 flex gap-1 overflow-x-auto">
            {(Object.entries(TAB_CONFIG) as [TabType, typeof TAB_CONFIG[TabType]][]).map(([key, cfg]) => {
              const Icon = cfg.icon
              const count = counts[key]
              const isActive = activeTab === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition text-sm font-medium whitespace-nowrap ${
                    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  <Icon size={15} className={isActive ? '' : cfg.color} />
                  {cfg.label}
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : key === 'pending' ? 'bg-warning/15 text-warning'
                        : key === 'review' ? 'bg-blue-500/15 text-blue-600'
                        : 'bg-secondary text-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="space-y-4">
            {filteredRequests.map((req) => {
              const rtInfo = req.result_type ? RESULT_TYPE_LABELS[req.result_type] : null
              const guidance = req.result_type ? REVIEW_GUIDANCE[req.result_type] : null
              const needsAction = req.status === 'pending' || req.status === 'review'
              const isThisRowReviewing = reviewingId === req.id

              return (
                <div key={req.id} className={`bg-card border rounded-lg overflow-hidden transition ${needsAction ? 'border-warning/40 shadow-sm' : 'border-border'}`}>
                  <button
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    className="w-full p-6 hover:bg-secondary/30 transition flex items-center justify-between"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">#{req.id} — {req.verification_code || 'N/A'}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          req.status === 'success' ? 'bg-success/10 text-success' :
                          req.status === 'pending' ? 'bg-warning/15 text-warning' :
                          req.status === 'review' ? 'bg-blue-500/15 text-blue-600' :
                          'bg-destructive/10 text-destructive'
                        }`}>
                          {req.status === 'success' ? '✓ Thành công' :
                           req.status === 'pending' ? '⏳ Chờ duyệt' :
                           req.status === 'review' ? '🔍 Cần xem xét' : '✗ Thất bại'}
                        </span>
                        {rtInfo && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rtInfo.bg} ${rtInfo.color}`}>
                            {rtInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm flex-wrap">
                        <span className="text-muted-foreground">{new Date(req.created_at).toLocaleString('vi-VN')}</span>
                        {req.confidence !== null && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${(req.confidence || 0) >= 0.7 ? 'bg-success/10 text-success' : (req.confidence || 0) >= 0.55 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                            {((req.confidence || 0) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown size={20} className={`text-muted-foreground transition flex-shrink-0 ml-4 ${expandedId === req.id ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedId === req.id && (
                    <div className="border-t border-border p-6 space-y-6 bg-secondary/10">

                      {needsAction && guidance && (
                        <div className="bg-warning/5 border border-warning/30 rounded-xl p-5">
                          <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                            <Shield size={18} className="text-warning" />
                            {guidance.title}
                          </h4>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Checklist xét duyệt:</p>
                          <ul className="space-y-1.5 mb-4">
                            {guidance.checks.map((check, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                <span className="text-warning mt-0.5 flex-shrink-0">□</span>
                                {check}
                              </li>
                            ))}
                          </ul>
                          <div className="p-3 bg-warning/10 rounded-lg">
                            <p className="text-xs text-foreground"><strong>💡 Gợi ý:</strong> {guidance.tip}</p>
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Eye size={16} className="text-primary" />
                          Ảnh Tài Liệu
                        </h4>
                        <RequestImage req={req} />
                      </div>

                      <div>
                        <h4 className="font-semibold text-foreground mb-4">Kết Quả</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-background rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-1">Phân loại</p>
                            <p className="font-semibold">{req.predicted_class === 'so_ho_ngheo' ? 'Sổ hộ nghèo' : req.predicted_class === 'giay_to_khac' ? 'Giấy tờ khác' : req.predicted_class || '—'}</p>
                          </div>
                          <div className="bg-background rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-1">Blur Score</p>
                            <p className="font-semibold">{req.blur_score?.toFixed(1) ?? '—'}
                              {req.blur_score !== null && req.blur_score !== undefined && (
                                <span className={`ml-2 text-xs ${req.blur_score < 50 ? 'text-destructive' : req.blur_score < 100 ? 'text-warning' : 'text-success'}`}>
                                  {req.blur_score < 50 ? '(quá mờ)' : req.blur_score < 100 ? '(mờ nhẹ)' : '(rõ)'}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="bg-background rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-1">Con dấu</p>
                            <p className="font-semibold">{req.stamp_detected ? `✅ Có (${(req.stamp_score * 100).toFixed(0)}%)` : `❌ Không (${(req.stamp_score * 100).toFixed(0)}%)`}</p>
                          </div>
                          <div className="bg-background rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-1">Forgery Score</p>
                            <p className="font-semibold">{(req.forgery_score * 100).toFixed(1)}%
                              <span className={`ml-2 text-xs ${req.forgery_score >= 0.7 ? 'text-destructive' : req.forgery_score >= 0.4 ? 'text-warning' : req.forgery_score >= 0.25 ? 'text-blue-500' : 'text-success'}`}>
                                {req.forgery_score >= 0.7 ? '(nguy hiểm)' : req.forgery_score >= 0.4 ? '(nghi ngờ)' : req.forgery_score >= 0.25 ? '(nhẹ)' : '(bình thường)'}
                              </span>
                            </p>
                          </div>
                          <div className="bg-background rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-1">Xử lý</p>
                            <p className="font-semibold">{req.processing_time_ms ? `${req.processing_time_ms}ms` : '—'}</p>
                          </div>
                          <div className="bg-background rounded-lg p-4">
                            <p className="text-xs text-muted-foreground mb-1">File</p>
                            <p className="font-semibold text-sm truncate">{req.original_filename || '—'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Đã bỏ phần OCR — vì đang ở DEMO mode trả text giả không có giá trị */}

                      {req.admin_notes && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                          <p className="text-sm"><strong>Ghi chú admin:</strong> {req.admin_notes}</p>
                        </div>
                      )}

                      {needsAction && (
                        <div>
                          <p className="text-sm font-semibold text-foreground mb-3">Quyết định xét duyệt:</p>
                          <div className="flex gap-4">
                            {/*
                              Đồng Ý — dùng inline style + bg-green-600 hardcoded
                              để đảm bảo hiển thị bất kể CSS variables có lỗi hay không.
                              Các class Tailwind chuẩn (green-600, green-700) chắc chắn có
                              giá trị màu cố định và không phụ thuộc theme/CSS vars.
                            */}
                            <button
                              type="button"
                              onClick={() => handleApprove(req.id)}
                              disabled={isThisRowReviewing}
                              style={{
                                backgroundColor: isThisRowReviewing ? '#16a34a99' : '#16a34a',
                                color: '#ffffff',
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-lg hover:brightness-110 disabled:cursor-not-allowed transition shadow-md"
                            >
                              {isThisRowReviewing && reviewingAction === 'approve' ? (
                                <Loader size={18} className="animate-spin" style={{ color: '#ffffff' }} />
                              ) : (
                                <CheckCircle size={20} style={{ color: '#ffffff' }} strokeWidth={2.5} />
                              )}
                              <span style={{ color: '#ffffff' }}>Đồng Ý</span>
                            </button>

                            {/*
                              Từ chối — dùng inline style + red-600 hardcoded cho nhất quán
                            */}
                            <button
                              type="button"
                              onClick={() => handleReject(req.id)}
                              disabled={isThisRowReviewing}
                              style={{
                                backgroundColor: isThisRowReviewing ? '#dc262699' : '#dc2626',
                                color: '#ffffff',
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-lg hover:brightness-110 disabled:cursor-not-allowed transition shadow-md"
                            >
                              {isThisRowReviewing && reviewingAction === 'reject' ? (
                                <Loader size={18} className="animate-spin" style={{ color: '#ffffff' }} />
                              ) : (
                                <XCircle size={20} style={{ color: '#ffffff' }} strokeWidth={2.5} />
                              )}
                              <span style={{ color: '#ffffff' }}>Từ Chối</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {filteredRequests.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle size={48} className="text-success mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-foreground mb-2">Không có hồ sơ</h3>
              <p className="text-muted-foreground">
                {activeTab === 'pending' ? 'Không có hồ sơ chờ duyệt' :
                 activeTab === 'review' ? 'Không có hồ sơ cần xem xét' :
                 'Không có dữ liệu'}
              </p>
            </div>
          )}
        </div>
      </main>
      {toast && <div className="fixed bottom-4 right-4 z-50"><Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /></div>}
      <Footer />
    </>
  )
}