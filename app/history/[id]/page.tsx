'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { ArrowLeft, Download, Share2, CheckCircle } from 'lucide-react'

export default function DetailedResultPage() {
  const params = useParams()
  const id = params.id as string

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <Link href="/history" className="flex items-center gap-2 text-primary hover:underline mb-4">
              <ArrowLeft size={20} />
              Quay lại lịch sử
            </Link>
            <h1 className="text-4xl font-bold text-foreground mb-2">Chi Tiết Kết Quả</h1>
            <p className="text-muted-foreground">Yêu cầu #{id}</p>
          </div>

          {/* Status Section */}
          <div className="bg-success/10 border border-success/30 rounded-xl p-8 mb-8">
            <div className="flex items-center gap-4">
              <CheckCircle className="text-success" size={40} />
              <div>
                <h2 className="text-2xl font-bold text-success mb-1">Xác Minh Thành Công</h2>
                <p className="text-muted-foreground">Tài liệu đã được xác minh và phê duyệt</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Ngày Tạo</p>
              <p className="font-semibold text-foreground">2024-02-10</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Loại Tài Liệu</p>
              <p className="font-semibold text-foreground">Sổ Hộ Nghèo</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Độ Tin Cậy</p>
              <p className="font-semibold text-foreground">98.5%</p>
            </div>
          </div>

          {/* Extracted Information */}
          <div className="bg-card border border-border rounded-xl p-8 mb-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Thông Tin Trích Xuất</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Họ và Tên</p>
                <p className="text-lg font-semibold text-foreground">Nguyễn Văn A</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Số CMND/CCCD</p>
                <p className="text-lg font-semibold text-foreground">123456789</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Năm Sinh</p>
                <p className="text-lg font-semibold text-foreground">1985</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Giới Tính</p>
                <p className="text-lg font-semibold text-foreground">Nam</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-2">Địa Chỉ Thường Trú</p>
                <p className="text-lg font-semibold text-foreground">Xã Thanh Lâm, Huyện Hạ Hòa, Tỉnh Phú Thọ</p>
              </div>
            </div>
          </div>

          {/* Field Confidence */}
          <div className="bg-card border border-border rounded-xl p-8 mb-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Độ Tin Cậy Theo Trường</h2>
            <div className="space-y-4">
              {[
                { field: 'Họ và Tên', confidence: 99 },
                { field: 'Số CMND', confidence: 98 },
                { field: 'Năm Sinh', confidence: 97 },
                { field: 'Giới Tính', confidence: 96 },
                { field: 'Địa Chỉ', confidence: 98 },
              ].map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{item.field}</span>
                    <span className="text-sm font-semibold text-foreground">{item.confidence}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-success h-2 rounded-full transition"
                      style={{ width: `${item.confidence}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Processing Details */}
          <div className="bg-card border border-border rounded-xl p-8 mb-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Chi Tiết Xử Lý</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-secondary/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">Thời Gian Xử Lý</p>
                <p className="text-2xl font-bold text-foreground">1.2 giây</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">Kích Thước File</p>
                <p className="text-2xl font-bold text-foreground">2.4 MB</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">Model OCR</p>
                <p className="text-lg font-bold text-foreground">v2.5.1</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">Phiên Bản API</p>
                <p className="text-lg font-bold text-foreground">v1.0.0</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition">
              <Download size={20} />
              Tải Xuống PDF
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground font-bold rounded-lg hover:bg-muted transition border border-border">
              <Share2 size={20} />
              Chia Sẻ
            </button>
          </div>

          {/* Footer Info */}
          <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Lưu ý:</strong> Kết quả này được lưu trữ an toàn trong tài khoản của bạn. Bạn có thể xem lại bất kỳ lúc nào từ trang Lịch Sử.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
