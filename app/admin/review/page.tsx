'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Toast, { ToastType } from '@/components/Toast'
import { CheckCircle, XCircle, Eye, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

interface ReviewRequest {
  id: string
  userName: string
  userId: string
  documentType: string
  status: 'pending' | 'approved' | 'rejected'
  confidence: number
  submittedDate: string
  extractedInfo: {
    fullName: string
    idNumber: string
    yearOfBirth: string
    address: string
  }
}

export default function AdminReviewPage() {
  const [requests] = useState<ReviewRequest[]>([
    {
      id: 'REQ-001',
      userName: 'Nguyễn Văn A',
      userId: 'USER-001',
      documentType: 'Sổ hộ nghèo',
      status: 'pending',
      confidence: 92.5,
      submittedDate: '2024-02-10 14:30',
      extractedInfo: {
        fullName: 'Nguyễn Văn A',
        idNumber: '123456789',
        yearOfBirth: '1985',
        address: 'Xã Thanh Lâm, Huyện Hạ Hòa, Phú Thọ',
      },
    },
    {
      id: 'REQ-002',
      userName: 'Trần Thị B',
      userId: 'USER-002',
      documentType: 'Chứng minh thư',
      status: 'pending',
      confidence: 88.3,
      submittedDate: '2024-02-10 13:15',
      extractedInfo: {
        fullName: 'Trần Thị B',
        idNumber: '987654321',
        yearOfBirth: '1990',
        address: 'Phường 1, TP. Hà Nội',
      },
    },
    {
      id: 'REQ-003',
      userName: 'Lê Văn C',
      userId: 'USER-003',
      documentType: 'Sổ hộ nghèo',
      status: 'pending',
      confidence: 75.2,
      submittedDate: '2024-02-10 11:45',
      extractedInfo: {
        fullName: 'Lê Văn C',
        idNumber: '555666777',
        yearOfBirth: '1988',
        address: 'Xã Thanh Sơn, Huyện Yên Lạc, Vĩnh Phúc',
      },
    },
  ])

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const handleApprove = (id: string) => {
    setToast({ message: 'Yêu cầu đã được phê duyệt', type: 'success' })
    setExpandedId(null)
  }

  const handleReject = (id: string) => {
    setToast({ message: 'Yêu cầu đã bị từ chối', type: 'warning' })
    setExpandedId(null)
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-4xl font-bold text-foreground">Duyệt Yêu Cầu</h1>
                <p className="text-muted-foreground">Kiểm tra và duyệt các yêu cầu xác minh đang chờ</p>
              </div>
              <Link href="/admin" className="text-primary hover:underline text-sm">
                ← Quay lại
              </Link>
            </div>
          </div>

          {/* Pending Count */}
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-8">
            <p className="text-sm font-medium text-warning">
              {pendingCount} yêu cầu đang chờ duyệt
            </p>
          </div>

          {/* Review List */}
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                  className="w-full p-6 hover:bg-secondary/30 transition flex items-center justify-between"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-4 mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{request.userName}</h3>
                        <p className="text-sm text-muted-foreground">{request.documentType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{request.submittedDate}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        request.confidence >= 90
                          ? 'bg-success/10 text-success'
                          : request.confidence >= 80
                          ? 'bg-primary/10 text-primary'
                          : 'bg-warning/10 text-warning'
                      }`}>
                        Độ tin cậy: {request.confidence}%
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        request.status === 'pending'
                          ? 'bg-warning/10 text-warning'
                          : request.status === 'approved'
                          ? 'bg-success/10 text-success'
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {request.status === 'pending' ? 'Chờ duyệt' : request.status === 'approved' ? 'Đã phê duyệt' : 'Từ chối'}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-muted-foreground transition ${expandedId === request.id ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Expanded Content */}
                {expandedId === request.id && (
                  <div className="border-t border-border p-6 space-y-6 bg-secondary/10">
                    {/* Extracted Information */}
                    <div>
                      <h4 className="font-semibold text-foreground mb-4">Thông Tin Được Trích Xuất</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-background rounded-lg p-4">
                          <p className="text-xs text-muted-foreground mb-1">Họ và tên</p>
                          <p className="font-semibold text-foreground">{request.extractedInfo.fullName}</p>
                        </div>
                        <div className="bg-background rounded-lg p-4">
                          <p className="text-xs text-muted-foreground mb-1">Số CMND</p>
                          <p className="font-semibold text-foreground">{request.extractedInfo.idNumber}</p>
                        </div>
                        <div className="bg-background rounded-lg p-4">
                          <p className="text-xs text-muted-foreground mb-1">Năm sinh</p>
                          <p className="font-semibold text-foreground">{request.extractedInfo.yearOfBirth}</p>
                        </div>
                        <div className="bg-background rounded-lg p-4 md:col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Địa chỉ</p>
                          <p className="font-semibold text-foreground">{request.extractedInfo.address}</p>
                        </div>
                      </div>
                    </div>

                    {/* Document Preview */}
                    <div>
                      <h4 className="font-semibold text-foreground mb-4">Xem Trước Tài Liệu</h4>
                      <div className="relative w-full h-64 bg-secondary rounded-lg flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <Eye size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Ảnh tài liệu</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {request.status === 'pending' && (
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleApprove(request.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-success text-white font-bold rounded-lg hover:opacity-90 transition"
                        >
                          <CheckCircle size={20} />
                          Phê Duyệt
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-destructive text-white font-bold rounded-lg hover:opacity-90 transition"
                        >
                          <XCircle size={20} />
                          Từ Chối
                        </button>
                      </div>
                    )}

                    {request.status !== 'pending' && (
                      <div className="p-4 bg-background rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Yêu cầu này đã được xử lý vào {request.submittedDate}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {pendingCount === 0 && (
            <div className="text-center py-12">
              <CheckCircle size={48} className="text-success mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-foreground mb-2">Không có yêu cầu chờ duyệt</h3>
              <p className="text-muted-foreground">Tất cả yêu cầu đã được xử lý</p>
            </div>
          )}
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
      <Footer />
    </>
  )
}
