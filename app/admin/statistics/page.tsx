'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { BarChart3, PieChart, TrendingUp } from 'lucide-react'
import { useState } from 'react'

export default function AdminStatisticsPage() {
  const [dateRange, setDateRange] = useState('30days')

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-4xl font-bold text-foreground">Thống Kê Chi Tiết</h1>
                <p className="text-muted-foreground">Phân tích và báo cáo hệ thống xác minh</p>
              </div>
              <Link href="/admin" className="text-primary hover:underline text-sm">
                ← Quay lại
              </Link>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="bg-card border border-border rounded-lg p-4 mb-8">
            <div className="flex flex-wrap gap-2">
              {[
                { value: '7days', label: '7 Ngày' },
                { value: '30days', label: '30 Ngày' },
                { value: '90days', label: '90 Ngày' },
                { value: 'alltime', label: 'Toàn Bộ' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value)}
                  className={`px-4 py-2 rounded-lg transition ${
                    dateRange === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-muted text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-muted-foreground text-sm mb-2">Yêu Cầu Mỗi Ngày</p>
              <p className="text-3xl font-bold text-foreground mb-2">145</p>
              <p className="text-sm text-success">+8% so với tuần trước</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-muted-foreground text-sm mb-2">Thời Gian Xử Lý Trung Bình</p>
              <p className="text-3xl font-bold text-foreground mb-2">2.3s</p>
              <p className="text-sm text-success">-0.5s so với tuần trước</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-muted-foreground text-sm mb-2">Độ Chính Xác Trung Bình</p>
              <p className="text-3xl font-bold text-foreground mb-2">94.2%</p>
              <p className="text-sm text-success">+1.2% so với tuần trước</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-muted-foreground text-sm mb-2">Người Dùng Mới</p>
              <p className="text-3xl font-bold text-foreground mb-2">23</p>
              <p className="text-sm text-success">+5 người so với tuần trước</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Verification Trend Chart */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                <BarChart3 size={20} />
                Xu Hướng Xác Minh
              </h2>
              <div className="space-y-4">
                {[
                  { day: 'Thứ 2', count: 340, percentage: 70 },
                  { day: 'Thứ 3', count: 420, percentage: 85 },
                  { day: 'Thứ 4', count: 380, percentage: 78 },
                  { day: 'Thứ 5', count: 450, percentage: 92 },
                  { day: 'Thứ 6', count: 520, percentage: 100 },
                  { day: 'Thứ 7', count: 480, percentage: 98 },
                  { day: 'Chủ nhật', count: 280, percentage: 57 },
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">{item.day}</span>
                      <span className="text-sm font-semibold text-foreground">{item.count} yêu cầu</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Type Distribution */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                <PieChart size={20} />
                Phân Bố Theo Loại Tài Liệu
              </h2>
              <div className="space-y-4">
                {[
                  { type: 'Sổ hộ nghèo', count: 1245, percentage: 55 },
                  { type: 'Chứng minh thư', count: 680, percentage: 30 },
                  { type: 'Hộ chiếu', count: 315, percentage: 14 },
                  { type: 'Khác', count: 62, percentage: 1 },
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">{item.type}</span>
                      <span className="text-sm font-semibold text-foreground">{item.percentage}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Tổng cộng:</strong> 2,302 yêu cầu
                </p>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <TrendingUp size={20} />
              Các Chỉ Số Hiệu Suất
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'Độ Tin Cậy Cao (>90%)', value: '1,850 (80.3%)' },
                { label: 'Độ Tin Cậy Trung Bình (70-90%)', value: '380 (16.5%)' },
                { label: 'Độ Tin Cậy Thấp (<70%)', value: '72 (3.2%)' },
                { label: 'Lỗi Xác Minh', value: '45 (2.0%)' },
                { label: 'Thời Gian Xử Lý Nhanh (<1s)', value: '1,200 (52.1%)' },
                { label: 'Thời Gian Xử Lý Trung Bình (1-5s)', value: '980 (42.6%)' },
                { label: 'Thời Gian Xử Lý Chậm (>5s)', value: '122 (5.3%)' },
                { label: 'Hệ Thống Uptime', value: '99.98%' },
              ].map((item, idx) => (
                <div key={idx} className="bg-secondary/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                  <p className="font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
