'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SUPPORT_CATEGORIES } from '@/lib/constants'
import { ArrowLeft, CheckCircle, AlertCircle, Loader, XCircle } from 'lucide-react'
import { getResult, type AdminRequest } from '@/lib/api'

export default function DetailedResultPage() {
  const params = useParams()
  const id = Number(params.id)
  const [record, setRecord] = useState<AdminRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchResult = async () => {
      try { setRecord(await getResult(id)) }
      catch (err) { setError(err instanceof Error ? err.message : 'Không thể tải kết quả') }
      finally { setLoading(false) }
    }
    if (id) fetchResult()
  }, [id])

  if (loading) return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center"><Loader size={48} className="animate-spin text-primary" /></main><Footer /></>)
  if (error || !record) return (<><Header /><main className="min-h-screen bg-background flex items-center justify-center px-4"><div className="text-center max-w-md"><AlertCircle size={48} className="text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold text-foreground mb-2">Không tìm thấy</h2><p className="text-muted-foreground mb-6">{error || 'Yêu cầu không tồn tại'}</p><Link href="/history" className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg inline-block">Quay lại</Link></div></main><Footer /></>)

  const isSuccess = record.status === 'success'
  const supportCats: string[] = (record as any).support_categories || []

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <Link href="/history" className="flex items-center gap-2 text-primary hover:underline mb-4"><ArrowLeft size={20} />Quay lại lịch sử</Link>
            <h1 className="text-4xl font-bold text-foreground mb-2">Chi Tiết Kết Quả</h1>
            <p className="text-muted-foreground">Mã: {record.verification_code || `#${record.id}`}</p>
          </div>

          {/* Status */}
          <div className={`border rounded-xl p-8 mb-8 ${isSuccess ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
            <div className="flex items-center gap-4">
              {isSuccess ? <CheckCircle className="text-success" size={40} /> : <XCircle className="text-destructive" size={40} />}
              <div>
                <h2 className={`text-2xl font-bold mb-1 ${isSuccess ? 'text-success' : 'text-destructive'}`}>
                  {isSuccess ? 'Xác Minh Thành Công' : 'Xác Minh Thất Bại'}
                </h2>
                <p className="text-muted-foreground">{record.message}</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {record.verification_code && <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Mã Xác Minh</p><p className="font-semibold font-mono">{record.verification_code}</p></div>}
            {record.confidence != null && <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Độ Tin Cậy</p><p className="font-semibold">{(record.confidence * 100).toFixed(1)}%</p></div>}
            {record.processing_time_ms && <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Thời Gian</p><p className="font-semibold">{(record.processing_time_ms / 1000).toFixed(1)}s</p></div>}
          </div>

          {/* MOI: Vat dung tiep te */}
          {supportCats.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-4">Nhu Cầu Hỗ Trợ</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {supportCats.map(catId => {
                  const cat = SUPPORT_CATEGORIES.find(c => c.id === catId)
                  return cat ? (
                    <div key={catId} className={`flex flex-col items-center justify-center p-3 rounded-lg ${cat.color}`}>
                      <span className="text-2xl mb-1">{cat.icon}</span>
                      <span className="text-xs font-semibold text-center">{cat.name}</span>
                    </div>
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* OCR */}
          {isSuccess && (record.household_name || record.extracted_text) && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Thông Tin Trích Xuất (OCR)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {record.household_name && <div><p className="text-sm text-muted-foreground mb-2">Họ và Tên</p><p className="text-lg font-semibold">{record.household_name}</p></div>}
                {record.household_id_number && <div><p className="text-sm text-muted-foreground mb-2">Mã Hộ</p><p className="text-lg font-semibold">{record.household_id_number}</p></div>}
                {record.household_address && <div className="md:col-span-2"><p className="text-sm text-muted-foreground mb-2">Địa Chỉ</p><p className="text-lg font-semibold">{record.household_address}</p></div>}
              </div>
              {record.extracted_text && (
                <div className="mt-6 bg-secondary/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">Raw Text</p>
                  <p className="text-sm whitespace-pre-wrap">{record.extracted_text}</p>
                </div>
              )}
            </div>
          )}

          {/* Pipeline */}
          <div className="bg-card border border-border rounded-xl p-8 mb-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Pipeline AI</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">Blur Score</p><p className="text-2xl font-bold">{record.blur_score?.toFixed(1) ?? '—'}</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">Stamp</p><p className="text-lg font-bold">{record.stamp_detected ? `Có (${(record.stamp_score * 100).toFixed(0)}%)` : 'Không'}</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">Forgery</p><p className="text-lg font-bold">{(record.forgery_score * 100).toFixed(1)}%</p></div>
              <div className="bg-secondary/30 rounded-lg p-4"><p className="text-sm text-muted-foreground mb-2">Loại tài liệu</p><p className="text-lg font-bold">{record.predicted_class === 'so_ho_ngheo' ? 'Sổ Hộ Nghèo' : record.predicted_class === 'giay_to_khac' ? 'Giấy Tờ Khác' : record.predicted_class || '—'}</p></div>
            </div>
          </div>

          {/* Location */}
          {(record.user_latitude || record.user_location_address) && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-4">Vị Trí</h2>
              <p>{record.user_location_address || `${record.user_latitude}, ${record.user_longitude}`}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Link href="/verify" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90">Xác Minh Khác</Link>
            <Link href="/history" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground font-bold rounded-lg hover:bg-muted border border-border">Lịch Sử</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}