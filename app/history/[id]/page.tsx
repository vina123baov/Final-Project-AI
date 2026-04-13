'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { ArrowLeft, Download, Share2, CheckCircle, AlertCircle, Loader, XCircle } from 'lucide-react'
import { getResult, type AdminRequest } from '@/lib/api'

export default function DetailedResultPage() {
  const params = useParams()
  const id = Number(params.id)
  const [record, setRecord] = useState<AdminRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const data = await getResult(id)
        setRecord(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải kết quả')
      } finally { setLoading(false) }
    }
    if (id) fetchResult()
  }, [id])

  if (loading) return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><Loader size={48} className="animate-spin text-primary mx-auto mb-4" /><p className="text-muted-foreground">Đang tải kết quả...</p></div></main><Footer /></>)
  if (error || !record) return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center px-4"><div className="text-center max-w-md"><AlertCircle size={48} className="text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold text-foreground mb-2">Không tìm thấy</h2><p className="text-muted-foreground mb-6">{error || 'Yêu cầu không tồn tại'}</p><Link href="/history" className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg inline-block">Quay lại lịch sử</Link></div></main><Footer /></>)

  const isSuccess = record.status === 'success'

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <Link href="/history" className="flex items-center gap-2 text-primary hover:underline mb-4"><ArrowLeft size={20} />Quay lại lịch sử</Link>
            <h1 className="text-4xl font-bold text-foreground mb-2">Chi Tiết Kết Quả</h1>
            <p className="text-muted-foreground">Mã xác minh: {record.verification_code || `#${record.id}`}</p>
          </div>

          {/* Status */}
          <div className={`border rounded-xl p-8 mb-8 ${isSuccess ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
            <div className="flex items-center gap-4">
              {isSuccess ? <CheckCircle className="text-success" size={40} /> : <XCircle className="text-destructive" size={40} />}
              <div>
                <h2 className={`text-2xl font-bold mb-1 ${isSuccess ? 'text-success' : 'text-destructive'}`}>
                  {isSuccess ? 'Xác Minh Thành Công' : record.result_type === 'blur' ? 'Ảnh Bị Mờ' : record.result_type === 'wrong_doc' ? 'Sai Loại Tài Liệu' : record.result_type === 'low_confidence' ? 'Không Nhận Diện Được' : 'Xác Minh Thất Bại'}
                </h2>
                <p className="text-muted-foreground">{record.message}</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Ngày Tạo</p><p className="font-semibold text-foreground">{new Date(record.created_at).toLocaleString('vi-VN')}</p></div>
            <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Loại Tài Liệu</p><p className="font-semibold text-foreground">{record.predicted_class === 'so_ho_ngheo' ? 'Sổ Hộ Nghèo' : record.predicted_class === 'giay_to_khac' ? 'Giấy Tờ Khác' : record.predicted_class === 'anh_khong_lien_quan' ? 'Không Liên Quan' : record.predicted_class || '—'}</p></div>
            <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Độ Tin Cậy</p><p className="font-semibold text-foreground">{record.confidence ? `${(record.confidence * 100).toFixed(1)}%` : '—'}</p></div>
          </div>

          {/* Extracted Info (OCR) */}
          {isSuccess && (record.household_name || record.extracted_text) && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Thông Tin Trích Xuất (OCR)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {record.household_name && <div><p className="text-sm text-muted-foreground mb-2">Họ và Tên</p><p className="text-lg font-semibold text-foreground">{record.household_name}</p></div>}
                {record.household_id_number && <div><p className="text-sm text-muted-foreground mb-2">Mã Hộ Nghèo</p><p className="text-lg font-semibold text-foreground">{record.household_id_number}</p></div>}
                {record.province && <div><p className="text-sm text-muted-foreground mb-2">Tỉnh/Thành</p><p className="text-lg font-semibold text-foreground">{record.province}</p></div>}
                {record.household_address && <div className="md:col-span-2"><p className="text-sm text-muted-foreground mb-2">Địa Chỉ</p><p className="text-lg font-semibold text-foreground">{record.household_address}</p></div>}
              </div>
              {record.extracted_text && (
                <div className="mt-6 bg-secondary/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">Raw Text (VietOCR)</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{record.extracted_text}</p>
                </div>
              )}
            </div>
          )}

          {/* Pipeline Details */}
          <div className="bg-card border border-border rounded-xl p-8 mb-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Chi Tiết Pipeline AI</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">Thời Gian Xử Lý</p><p className="text-2xl font-bold text-foreground">{record.processing_time_ms ? `${(record.processing_time_ms / 1000).toFixed(1)} giây` : '—'}</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">Blur Score</p><p className="text-2xl font-bold text-foreground">{record.blur_score?.toFixed(1) ?? '—'}</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">Stamp Detection</p><p className="text-lg font-bold text-foreground">{record.stamp_detected ? `Có con dấu (${(record.stamp_score * 100).toFixed(0)}%)` : 'Không phát hiện'}</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">Forgery Score</p><p className="text-lg font-bold text-foreground">{(record.forgery_score * 100).toFixed(1)}%</p></div>
              {record.ocr_confidence && <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">OCR Confidence</p><p className="text-lg font-bold text-foreground">{(record.ocr_confidence * 100).toFixed(1)}%</p></div>}
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">File Gốc</p><p className="text-lg font-bold text-foreground truncate">{record.original_filename || '—'}</p></div>
            </div>
          </div>

          {/* Location */}
          {(record.user_latitude || record.user_location_address) && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-4">Vị Trí</h2>
              <p className="text-foreground">{record.user_location_address || `${record.user_latitude}, ${record.user_longitude}`}</p>
            </div>
          )}

          {/* Admin Review */}
          {record.reviewed_by && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-4">Admin Review</h2>
              <p className="text-foreground">Duyệt bởi: {record.reviewed_by}</p>
              {record.admin_notes && <p className="text-muted-foreground mt-2">Ghi chú: {record.admin_notes}</p>}
              {record.verified_at && <p className="text-xs text-muted-foreground mt-2">Thời gian: {new Date(record.verified_at).toLocaleString('vi-VN')}</p>}
            </div>
          )}

          {/* Confidence Bar */}
          {record.confidence && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Độ Tin Cậy Chi Tiết</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-foreground">Model Confidence</span><span className="text-sm font-semibold">{(record.confidence * 100).toFixed(1)}%</span></div>
                  <div className="w-full bg-secondary rounded-full h-2"><div className={`h-2 rounded-full ${record.confidence >= 0.7 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${record.confidence * 100}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-foreground">Stamp Score</span><span className="text-sm font-semibold">{(record.stamp_score * 100).toFixed(1)}%</span></div>
                  <div className="w-full bg-secondary rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{ width: `${record.stamp_score * 100}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-foreground">Blur Score</span><span className="text-sm font-semibold">{record.blur_score?.toFixed(0) ?? 0}</span></div>
                  <div className="w-full bg-secondary rounded-full h-2"><div className="bg-success h-2 rounded-full" style={{ width: `${Math.min(((record.blur_score ?? 0) / 500) * 100, 100)}%` }} /></div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Link href="/verify" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition">Xác Minh Tài Liệu Khác</Link>
            <Link href="/history" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground font-bold rounded-lg hover:bg-muted transition border border-border">Quay Lại Lịch Sử</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}