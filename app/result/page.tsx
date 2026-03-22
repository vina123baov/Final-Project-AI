'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SUPPORT_CATEGORIES } from '@/lib/constants'
import { CheckCircle, AlertTriangle, AlertCircle, Download, RotateCcw, MapPin } from 'lucide-react'

type VerificationStatus = 'success' | 'blur' | 'low-confidence' | 'wrong-document' | 'invalid'

interface LocationData {
  latitude: number
  longitude: number
  address?: string
  accuracy?: number
}

export default function ResultPage() {
  const [status] = useState<VerificationStatus>('success')
  const [location, setLocation] = useState<LocationData | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  useEffect(() => {
    const data = sessionStorage.getItem('verificationData')
    if (data) {
      const parsed = JSON.parse(data)
      setLocation(parsed.location)
      setSelectedCategories(parsed.selectedCategories)
    }
  }, [])

  const statusConfig = {
    success: {
      icon: CheckCircle,
      color: 'success',
      title: 'Xác Minh Thành Công!',
      message: 'Thông tin sổ hộ nghèo của bạn đã được xác minh thành công.',
      bgClass: 'bg-success/10 border-success/30',
      textClass: 'text-success',
    },
    blur: {
      icon: AlertTriangle,
      color: 'warning',
      title: 'Ảnh Mờ',
      message: 'Ảnh bạn tải lên quá mờ. Vui lòng chụp ảnh rõ ràng hơn và thử lại.',
      bgClass: 'bg-warning/10 border-warning/30',
      textClass: 'text-warning',
    },
    'low-confidence': {
      icon: AlertTriangle,
      color: 'warning',
      title: 'Không Thể Xác Định',
      message: 'Hệ thống không thể xác định thông tin rõ ràng. Vui lòng chụp ảnh mới.',
      bgClass: 'bg-warning/10 border-warning/30',
      textClass: 'text-warning',
    },
    'wrong-document': {
      icon: AlertCircle,
      color: 'destructive',
      title: 'Tài Liệu Không Hợp Lệ',
      message: 'Tài liệu tải lên không phải là sổ hộ nghèo. Vui lòng kiểm tra lại.',
      bgClass: 'bg-destructive/10 border-destructive/30',
      textClass: 'text-destructive',
    },
    invalid: {
      icon: AlertCircle,
      color: 'destructive',
      title: 'Ảnh Không Hợp Lệ',
      message: 'Ảnh tải lên không hợp lệ hoặc bị hỏng. Vui lòng thử ảnh khác.',
      bgClass: 'bg-destructive/10 border-destructive/30',
      textClass: 'text-destructive',
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          {/* Status Card */}
          <div className={`border rounded-xl p-8 mb-8 ${config.bgClass}`}>
            <div className="flex items-center gap-4 mb-4">
              <Icon className={config.textClass} size={40} />
              <h1 className={`text-2xl font-bold ${config.textClass}`}>{config.title}</h1>
            </div>
            <p className="text-muted-foreground">{config.message}</p>
          </div>

          {/* Extracted Information */}
          {status === 'success' && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Thông Tin Được Trích Xuất</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Họ và tên</p>
                    <p className="font-semibold text-foreground">Nguyễn Văn A</p>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Số CMND</p>
                    <p className="font-semibold text-foreground">123456789</p>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Năm sinh</p>
                    <p className="font-semibold text-foreground">1985</p>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Giới tính</p>
                    <p className="font-semibold text-foreground">Nam</p>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-4 md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Địa chỉ thường trú</p>
                    <p className="font-semibold text-foreground">Xã Thanh Lâm, Huyện Hạ Hòa, Phú Thọ</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Độ chính xác:</strong> 98.5%
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Thời gian xử lý:</strong> 1.2 giây
                </p>
              </div>
            </div>
          )}

          {/* Location & Support Needs */}
          {location && selectedCategories.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
              <h2 className="text-xl font-bold text-foreground mb-6">Thông Tin Bổ Sung</h2>
              
              {/* Location */}
              <div className="mb-6 pb-6 border-b border-border">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <MapPin className="text-primary" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground mb-1">Vị Trí Gia Đình</p>
                    <p className="text-sm text-muted-foreground">
                      {location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                    </p>
                    {location.accuracy && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Độ chính xác: ±{Math.round(location.accuracy)} mét
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Support Categories */}
              <div>
                <p className="font-semibold text-foreground mb-4">Nhu Cầu Hỗ Trợ</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {selectedCategories.map(categoryId => {
                    const category = SUPPORT_CATEGORIES.find(c => c.id === categoryId)
                    return (
                      <div
                        key={categoryId}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg ${category?.color}`}
                      >
                        <span className="text-2xl mb-1">{category?.icon}</span>
                        <span className="text-xs font-semibold text-center">{category?.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/verify"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition"
            >
              <RotateCcw size={20} />
              Xác Minh Tài Liệu Khác
            </Link>
            <button className="flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground font-bold rounded-lg hover:bg-muted transition border border-border">
              <Download size={20} />
              Tải Kết Quả
            </button>
          </div>

          {/* Info Section */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-bold text-foreground mb-3">Tiếp Theo?</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✓ Kết quả đã được lưu trong tài khoản của bạn</li>
                <li>✓ Bạn có thể xem lại kết quả bất kỳ lúc nào</li>
                <li>✓ Chia sẻ kết quả với những người được phép</li>
              </ul>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-bold text-foreground mb-3">Cần Trợ Giúp?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Nếu có bất kỳ câu hỏi hoặc vấn đề, vui lòng liên hệ với chúng tôi
              </p>
              <a href="#" className="text-primary font-semibold hover:underline text-sm">
                Liên hệ hỗ trợ →
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
