'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { ChevronRight, CheckCircle, AlertTriangle, Eye, Download } from 'lucide-react'

interface VerificationRecord {
  id: string
  date: string
  documentType: string
  status: 'success' | 'warning' | 'error'
  confidence: number
  documentName: string
}

export default function HistoryPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const records: VerificationRecord[] = [
    {
      id: '1',
      date: '2024-02-10',
      documentType: 'Sổ hộ nghèo',
      status: 'success',
      confidence: 98.5,
      documentName: 'Ho_Ngheo_2024.jpg',
    },
    {
      id: '2',
      date: '2024-02-09',
      documentType: 'Chứng minh thư',
      status: 'success',
      confidence: 97.2,
      documentName: 'CMND_001.jpg',
    },
    {
      id: '3',
      date: '2024-02-08',
      documentType: 'Sổ hộ nghèo',
      status: 'warning',
      confidence: 78.5,
      documentName: 'Ho_Ngheo_Jan.jpg',
    },
    {
      id: '4',
      date: '2024-02-07',
      documentType: 'Hộ chiếu',
      status: 'success',
      confidence: 99.1,
      documentName: 'Passport_2024.jpg',
    },
    {
      id: '5',
      date: '2024-02-06',
      documentType: 'Sổ hộ nghèo',
      status: 'success',
      confidence: 95.8,
      documentName: 'Ho_Ngheo_Feb.jpg',
    },
    {
      id: '6',
      date: '2024-02-05',
      documentType: 'Chứng minh thư',
      status: 'error',
      confidence: 0,
      documentName: 'CMND_Invalid.jpg',
    },
    {
      id: '7',
      date: '2024-02-04',
      documentType: 'Sổ hộ nghèo',
      status: 'success',
      confidence: 96.3,
      documentName: 'Ho_Ngheo_Backup.jpg',
    },
    {
      id: '8',
      date: '2024-02-03',
      documentType: 'Chứng minh thư',
      status: 'success',
      confidence: 98.9,
      documentName: 'CMND_002.jpg',
    },
  ]

  const totalPages = Math.ceil(records.length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const paginatedRecords = records.slice(startIdx, startIdx + itemsPerPage)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-success" size={20} />
      case 'warning':
        return <AlertTriangle className="text-warning" size={20} />
      case 'error':
        return <AlertTriangle className="text-destructive" size={20} />
      default:
        return null
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Thành công'
      case 'warning':
        return 'Cảnh báo'
      case 'error':
        return 'Lỗi'
      default:
        return ''
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-success/10 text-success'
      case 'warning':
        return 'bg-warning/10 text-warning'
      case 'error':
        return 'bg-destructive/10 text-destructive'
      default:
        return ''
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Lịch Sử Xác Minh</h1>
            <p className="text-muted-foreground">Xem các yêu cầu xác minh trước đó của bạn</p>
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="Tìm kiếm theo tên tài liệu..."
                className="flex-1 px-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select className="px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Tất cả trạng thái</option>
                <option value="success">Thành công</option>
                <option value="warning">Cảnh báo</option>
                <option value="error">Lỗi</option>
              </select>
              <select className="px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Tất cả loại tài liệu</option>
                <option value="sohongheo">Sổ hộ nghèo</option>
                <option value="cmnd">Chứng minh thư</option>
                <option value="hochiep">Hộ chiếu</option>
              </select>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Ngày</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Loại Tài Liệu</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Tên File</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Trạng Thái</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Độ Chính Xác</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border hover:bg-secondary/30 transition">
                      <td className="px-6 py-4 text-sm text-foreground">{record.date}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{record.documentType}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{record.documentName}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(record.status)}
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBg(record.status)}`}>
                            {getStatusText(record.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {record.confidence > 0 ? `${record.confidence}%` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground hover:text-foreground" title="Xem chi tiết">
                            <Eye size={16} />
                          </button>
                          <button className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground hover:text-foreground" title="Tải xuống">
                            <Download size={16} />
                          </button>
                          <Link href={`/history/${record.id}`} className="p-2 hover:bg-secondary rounded-lg transition text-muted-foreground hover:text-foreground">
                            <ChevronRight size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Hiển thị {startIdx + 1} đến {Math.min(startIdx + itemsPerPage, records.length)} trong {records.length} kết quả
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 transition text-foreground"
              >
                Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg transition ${
                    currentPage === page
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border hover:bg-secondary text-foreground'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 transition text-foreground"
              >
                Sau
              </button>
            </div>
          </div>

          {/* Empty State - Uncomment to test */}
          {/* <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-foreground mb-2">Không có dữ liệu</h3>
            <p className="text-muted-foreground mb-6">Bạn chưa xác minh tài liệu nào</p>
            <Link href="/verify" className="inline-block px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90">
              Bắt Đầu Xác Minh
            </Link>
          </div> */}
        </div>
      </main>
      <Footer />
    </>
  )
}
