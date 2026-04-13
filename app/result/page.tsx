'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SUPPORT_CATEGORIES } from '@/lib/constants'
import { CheckCircle, AlertTriangle, AlertCircle, RotateCcw, MapPin } from 'lucide-react'

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

export default function ResultPage() {
  const [data, setData] = useState<VerificationData | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('verificationData')
    if (stored) {
      setData(JSON.parse(stored))
    }
  }, [])

  if (!data) {
    return (
      <><Header /><main className="min-h-screen bg-background flex items-center justify-center px-4"><div className="text-center"><AlertCircle size={48} className="text-warning mx-auto mb-4" /><h2 className="text-xl font-bold text-foreground mb-2">Không có kết quả</h2><p className="text-muted-foreground mb-6">Vui lòng xác minh tài liệu trước</p><Link href="/verify" className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg inline-block">Xác Minh Ngay</Link></div></main><Footer /></>
    )
  }

  const isSuccess = data.status === 'success'

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          {/* Status */}
          <div className={`border rounded-xl p-8 mb-8 ${isSuccess ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
            <div className="flex items-center gap-4">
              {isSuccess ? <CheckCircle className="text-success" size={40} /> : <AlertTriangle className="text-destructive" size={40} />}
              <div>
                <h1 className={`text-2xl font-bold mb-1 ${isSuccess ? 'text-success' : 'text-destructive'}`}>
                  {isSuccess ? 'Xác Minh Thành Công!' : 'Xác Minh Thất Bại'}
                </h1>
                <p className="text-muted-foreground">
                  {isSuccess ? 'Sổ hộ nghèo đã được xác minh thành công.' : 'Tài liệu không hợp lệ. Vui lòng thử lại.'}
                </p>
              </div>
            </div>
          </div>

          {/* Verification Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {data.verification_code && (
              <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Mã Xác Minh</p><p className="font-semibold text-foreground font-mono">{data.verification_code}</p></div>
            )}
            {data.confidence !== null && (
              <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Độ Tin Cậy</p><p className="font-semibold text-foreground">{(data.confidence * 100).toFixed(1)}%</p></div>
            )}
            {data.processing_time_ms && (
              <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground mb-1">Thời Gian Xử Lý</p><p className="font-semibold text-foreground">{(data.processing_time_ms / 1000).toFixed(1)} giây</p></div>
            )}
          </div>

          {/* Location & Support Needs */}
          {data.location && data.selectedCategories.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Thông Tin Hỗ Trợ</h2>

              <div className="mb-6 pb-6 border-b border-border">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0"><MapPin className="text-primary" size={20} /></div>
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
            <Link href="/verify" className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition">
              <RotateCcw size={20} />Xác Minh Tài Liệu Khác
            </Link>
            <Link href="/history" className="flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground font-bold rounded-lg hover:bg-muted transition border border-border">
              Xem Lịch Sử
            </Link>
          </div>

          <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Lưu ý:</strong> Kết quả đã được lưu trong tài khoản của bạn. Chỉ hiển thị mã xác minh, vị trí và nhu cầu hỗ trợ — không lưu thông tin cá nhân.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}