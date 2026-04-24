'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SUPPORT_CATEGORIES } from '@/lib/constants'
import { CheckCircle, AlertTriangle, AlertCircle, RotateCcw, MapPin, Clock, Eye, Shield, FileSearch } from 'lucide-react'

interface VerificationData {
  id: number | null
  verification_code: string | null
  location: { latitude: number; longitude: number; address?: string } | null
  selectedCategories: string[]
  confidence: number | null
  status: string
  result_type: string | null
  extracted_text: string | null
  household_name: string | null
  household_address: string | null
  processing_time_ms: number | null
  timestamp: string
}

// Cấu hình hiển thị theo từng trạng thái
const STATUS_CONFIG: Record<string, {
  icon: React.FC<{ size?: number; className?: string }>
  bgClass: string
  borderClass: string
  textClass: string
  iconClass: string
  title: string
  subtitle: string
  badge: string
  badgeClass: string
  showRetry: boolean
}> = {
  success: {
    icon: CheckCircle,
    bgClass: 'bg-success/10',
    borderClass: 'border-success/30',
    textClass: 'text-success',
    iconClass: 'text-success',
    title: 'Xác Minh Thành Công!',
    subtitle: 'Sổ hộ nghèo đã được xác minh thành công.',
    badge: '✓ Đã xác minh',
    badgeClass: 'bg-success/15 text-success border-success/30',
    showRetry: false,
  },
  pending: {
    icon: Clock,
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/30',
    textClass: 'text-warning',
    iconClass: 'text-warning',
    title: 'Đang Chờ Xét Duyệt',
    subtitle: 'Hồ sơ của bạn đã được ghi nhận và đang chờ nhân viên xem xét thủ công.',
    badge: '⏳ Chờ duyệt',
    badgeClass: 'bg-warning/15 text-warning border-warning/30',
    showRetry: false,
  },
  review: {
    icon: Eye,
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    textClass: 'text-blue-600',
    iconClass: 'text-blue-500',
    title: 'Cần Xem Xét Thêm',
    subtitle: 'Tài liệu cần được nhân viên kiểm tra kỹ hơn trước khi xác nhận.',
    badge: '🔍 Đang xem xét',
    badgeClass: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    showRetry: false,
  },
  failed: {
    icon: AlertTriangle,
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
    textClass: 'text-destructive',
    iconClass: 'text-destructive',
    title: 'Xác Minh Thất Bại',
    subtitle: 'Tài liệu không hợp lệ. Vui lòng thử lại.',
    badge: '✗ Thất bại',
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
    showRetry: true,
  },
}

const RESULT_TYPE_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  success: { label: 'Xác minh thành công', icon: '✅', desc: 'Sổ hộ nghèo hợp lệ' },
  blur: { label: 'Ảnh quá mờ', icon: '📷', desc: 'Vui lòng chụp lại rõ hơn' },
  review_blur: { label: 'Con dấu/chữ ký mờ', icon: '🔍', desc: 'Gửi để xem xét thủ công' },
  review_forgery: { label: 'Nghi ngờ nhẹ', icon: '🛡️', desc: 'Kiểm tra tính xác thực' },
  pending_forgery: { label: 'Nghi ngờ vừa', icon: '⚠️', desc: 'Chờ admin xác nhận' },
  pending_no_stamp: { label: 'Không tìm thấy con dấu', icon: '🔎', desc: 'Chờ admin xác nhận' },
  pending_low_confidence: { label: 'Độ tin cậy biên giới', icon: '📊', desc: 'Chờ admin xác nhận' },
  wrong_doc: { label: 'Sai tài liệu', icon: '📄', desc: 'Không phải sổ hộ nghèo' },
  invalid: { label: 'Ảnh không hợp lệ', icon: '🚫', desc: 'Vui lòng chụp lại' },
  low_confidence: { label: 'Độ tin cậy thấp', icon: '📉', desc: 'Không nhận diện được' },
  forgery: { label: 'Phát hiện giả mạo', icon: '🚨', desc: 'Ảnh có dấu hiệu chỉnh sửa' },
}

// Timeline steps cho pending/review
const PENDING_STEPS = [
  { icon: FileSearch, label: 'Đã nhận hồ sơ', done: true, active: false },
  { icon: Eye, label: 'Đang xem xét thủ công', done: false, active: true },
  { icon: Shield, label: 'Xác minh hoàn tất', done: false, active: false },
]

export default function ResultPage() {
  const [data, setData] = useState<VerificationData | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('verificationData')
    if (stored) setData(JSON.parse(stored))
  }, [])

  if (!data) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="text-center">
            <AlertCircle size={48} className="text-warning mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Không có kết quả</h2>
            <p className="text-muted-foreground mb-6">Vui lòng xác minh tài liệu trước</p>
            <Link href="/verify" className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg inline-block">
              Xác Minh Ngay
            </Link>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const statusKey = (data.status === 'review' || data.status === 'pending') ? data.status : (data.status === 'success' ? 'success' : 'failed')
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.failed
  const StatusIcon = config.icon
  const resultTypeInfo = data.result_type ? RESULT_TYPE_LABELS[data.result_type] : null
  const isPendingOrReview = data.status === 'pending' || data.status === 'review'

  const getProcessingTimeDisplay = (): string | null => {
    const ms = data.processing_time_ms
    if (!ms || ms <= 0) return null
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)} giây`
  }
  const processingTimeDisplay = getProcessingTimeDisplay()

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-2xl">

          {/* Status Banner */}
          <div className={`border rounded-xl p-8 mb-8 ${config.bgClass} ${config.borderClass}`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center ${config.bgClass} border ${config.borderClass}`}>
                <StatusIcon size={32} className={config.iconClass} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className={`text-2xl font-bold ${config.textClass}`}>{config.title}</h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.badgeClass}`}>
                    {config.badge}
                  </span>
                </div>
                <p className="text-muted-foreground">{config.subtitle}</p>

                {/* Result type tag */}
                {resultTypeInfo && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-background/60 rounded-lg border border-border text-sm">
                    <span>{resultTypeInfo.icon}</span>
                    <span className="font-medium text-foreground">{resultTypeInfo.label}</span>
                    <span className="text-muted-foreground">— {resultTypeInfo.desc}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pending/Review — Timeline & hướng dẫn */}
          {isPendingOrReview && (
            <div className="bg-card border border-border rounded-xl p-6 mb-8">
              <h2 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
                <Clock size={18} className="text-warning" />
                Quy trình xét duyệt
              </h2>

              {/* Timeline */}
              <div className="relative">
                {PENDING_STEPS.map((step, idx) => {
                  const Icon = step.icon
                  return (
                    <div key={idx} className="flex items-start gap-4 mb-4 last:mb-0">
                      <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                          step.done
                            ? 'bg-success border-success text-white'
                            : step.active
                            ? 'bg-warning/20 border-warning text-warning animate-pulse'
                            : 'bg-muted border-border text-muted-foreground'
                        }`}>
                          <Icon size={16} />
                        </div>
                        {idx < PENDING_STEPS.length - 1 && (
                          <div className={`w-0.5 h-6 mt-1 ${step.done ? 'bg-success' : 'bg-border'}`} />
                        )}
                      </div>
                      <div className="pt-1.5">
                        <p className={`text-sm font-semibold ${
                          step.done ? 'text-success' : step.active ? 'text-warning' : 'text-muted-foreground'
                        }`}>
                          {step.label}
                          {step.active && <span className="ml-2 text-xs font-normal opacity-70">• đang xử lý</span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Thông tin thêm */}
              <div className="mt-5 p-4 bg-warning/5 border border-warning/20 rounded-lg">
                <p className="text-sm text-foreground font-medium mb-1">📋 Bạn cần làm gì?</p>
                <p className="text-sm text-muted-foreground">
                  Không cần làm gì thêm. Hồ sơ của bạn đã được ghi nhận. Nhân viên sẽ xem xét và
                  cập nhật kết quả trong <strong className="text-foreground">1–3 ngày làm việc</strong>.
                  Bạn có thể theo dõi tại trang{' '}
                  <Link href="/history" className="text-primary hover:underline font-medium">Lịch sử</Link>.
                </p>
              </div>

              {/* Lý do cụ thể */}
              {data.result_type && (
                <div className="mt-3 p-4 bg-secondary/40 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Lý do chuyển sang xét duyệt: </strong>
                    {data.result_type === 'review_blur' && 'Con dấu hoặc chữ ký trong ảnh bị mờ, khó đọc chính xác. Ảnh vẫn có thể hợp lệ — nhân viên sẽ xác nhận trực tiếp.'}
                    {data.result_type === 'review_forgery' && 'Hệ thống phát hiện một số dấu hiệu bất thường nhẹ trong ảnh. Thường là do chất lượng ảnh, không phải giả mạo.'}
                    {data.result_type === 'pending_forgery' && 'Ảnh có một số điểm bất thường cần xác minh thêm. Nhân viên sẽ kiểm tra chi tiết.'}
                    {data.result_type === 'pending_no_stamp' && 'Hệ thống không tìm thấy con dấu đỏ rõ ràng. Nếu sổ có con dấu, nhân viên sẽ xác nhận.'}
                    {data.result_type === 'pending_low_confidence' && 'Mức độ nhận diện chưa đủ chắc chắn để tự động xác minh. Nhân viên sẽ xem xét trực tiếp.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info Cards */}
          <div className={`grid grid-cols-1 ${processingTimeDisplay ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-8`}>
            {data.verification_code && (
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Mã Xác Minh</p>
                <p className="font-semibold text-foreground font-mono">{data.verification_code}</p>
              </div>
            )}
            {data.confidence !== null && data.confidence !== undefined && (
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Độ Tin Cậy AI</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{(data.confidence * 100).toFixed(1)}%</p>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${data.confidence >= 0.7 ? 'bg-success' : data.confidence >= 0.55 ? 'bg-warning' : 'bg-destructive'}`}
                      style={{ width: `${data.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
            {processingTimeDisplay && (
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Thời Gian Xử Lý</p>
                <p className="font-semibold text-foreground">{processingTimeDisplay}</p>
              </div>
            )}
          </div>

          {/* Location & Support (chỉ hiện khi có) */}
          {data.location && data.selectedCategories.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Thông Tin Hỗ Trợ</h2>
              <div className="mb-6 pb-6 border-b border-border">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <MapPin className="text-primary" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground mb-1">Vị Trí Gia Đình</p>
                    <p className="text-sm text-muted-foreground">
                      {data.location.address || `${data.location.latitude.toFixed(4)}, ${data.location.longitude.toFixed(4)}`}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-4">Nhu Cầu Hỗ Trợ</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {data.selectedCategories.map(categoryId => {
                    const category = SUPPORT_CATEGORIES.find(c => c.id === categoryId)
                    return category ? (
                      <div key={categoryId} className={`flex flex-col items-center justify-center p-3 rounded-lg ${category.color}`}>
                        <span className="text-2xl mb-1">{category.icon}</span>
                        <span className="text-xs font-semibold text-center">{category.name}</span>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.showRetry ? (
              <Link href="/verify" className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition">
                <RotateCcw size={20} /> Xác Minh Lại
              </Link>
            ) : (
              <Link href="/verify" className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition">
                <RotateCcw size={20} /> Xác Minh Tài Liệu Khác
              </Link>
            )}
            <Link href="/history" className="flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground font-bold rounded-lg hover:bg-muted transition border border-border">
              Xem Lịch Sử
            </Link>
          </div>

          <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Lưu ý:</strong>{' '}
              {isPendingOrReview
                ? 'Kết quả đã được ghi nhận. Nhân viên sẽ liên hệ hoặc cập nhật trạng thái trong trang Lịch sử.'
                : 'Kết quả đã được lưu trong tài khoản của bạn. Không lưu thông tin cá nhân nhạy cảm.'}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}