'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AdminMap from '@/components/AdminMap'
import { TrendingUp, Users, CheckCircle, AlertCircle, BarChart3, MapPin } from 'lucide-react'

export default function AdminDashboardPage() {
  const [selectedFamily, setSelectedFamily] = useState<any>(null)

  // Sample data for families with locations
  const familiesWithLocations = [
    {
      id: '1',
      name: 'Gia Đình Nguyễn Văn A',
      latitude: 21.0285,
      longitude: 105.8542,
      address: 'Quận Hoàn Kiếm, Hà Nội',
      supportNeeds: ['rice', 'water', 'medicine'],
      status: 'verified' as const,
    },
    {
      id: '2',
      name: 'Gia Đình Trần Thị B',
      latitude: 21.0382,
      longitude: 105.7845,
      address: 'Quận Ba Đình, Hà Nội',
      supportNeeds: ['bread', 'clothes', 'school_supplies'],
      status: 'pending' as const,
    },
    {
      id: '3',
      name: 'Gia Đình Lê Văn C',
      latitude: 21.0128,
      longitude: 105.8845,
      address: 'Quận Hai Bà Trưng, Hà Nội',
      supportNeeds: ['rice', 'food', 'water'],
      status: 'verified' as const,
    },
  ]

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard Quản Trị</h1>
            <p className="text-muted-foreground">Tổng quan thống kê hệ thống xác minh</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Requests */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Tổng Yêu Cầu</h3>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="text-primary" size={24} />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground mb-2">2,847</p>
              <p className="text-sm text-success">+12% so với tháng trước</p>
            </div>

            {/* Success Rate */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Tỷ Lệ Thành Công</h3>
                <div className="p-2 bg-success/10 rounded-lg">
                  <CheckCircle className="text-success" size={24} />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground mb-2">94.2%</p>
              <p className="text-sm text-muted-foreground">2,680 yêu cầu thành công</p>
            </div>

            {/* Active Users */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Người Dùng Hoạt Động</h3>
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Users className="text-accent" size={24} />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground mb-2">512</p>
              <p className="text-sm text-success">+8% tăng hôm nay</p>
            </div>

            {/* Failed Requests */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Yêu Cầu Thất Bại</h3>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertCircle className="text-warning" size={24} />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground mb-2">167</p>
              <p className="text-sm text-warning">Cần kiểm tra</p>
            </div>
          </div>

          {/* Map Section */}
          <div className="bg-card border border-border rounded-xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="text-primary" size={24} />
              <h2 className="text-lg font-bold text-foreground">Bản Đồ Phân Bố Gia Đình</h2>
            </div>
            <AdminMap
              families={familiesWithLocations}
              onFamilySelect={setSelectedFamily}
            />
            
            {selectedFamily && (
              <div className="mt-4 p-4 border-t border-border">
                <h3 className="font-semibold text-foreground mb-3">{selectedFamily.name}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Địa chỉ</p>
                    <p className="text-foreground font-medium">{selectedFamily.address}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Trạng thái</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      selectedFamily.status === 'verified' ? 'bg-success/10 text-success' :
                      selectedFamily.status === 'pending' ? 'bg-warning/10 text-warning' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {selectedFamily.status === 'verified' ? 'Đã xác minh' :
                       selectedFamily.status === 'pending' ? 'Đang chờ' : 'Bị từ chối'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-2">Nhu cầu hỗ trợ</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedFamily.supportNeeds.map((need: string) => (
                        <span key={need} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                          {need}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Verification Trend */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-foreground mb-6">Xu Hướng Xác Minh 7 Ngày</h2>
              <div className="h-64 flex items-end justify-between gap-2">
                {[340, 420, 380, 450, 520, 480, 580].map((value, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t-lg transition hover:from-primary/80 hover:to-primary/40"
                      style={{ height: `${(value / 580) * 100}%` }}
                    />
                    <p className="text-xs text-muted-foreground mt-2">T{idx + 2}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-bold text-foreground mb-6">Phân Bố Trạng Thái</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground">Thành công</span>
                    <span className="text-sm font-semibold text-foreground">94.2%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-success h-2 rounded-full" style={{ width: '94.2%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground">Cảnh báo</span>
                    <span className="text-sm font-semibold text-foreground">3.8%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-warning h-2 rounded-full" style={{ width: '3.8%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground">Lỗi</span>
                    <span className="text-sm font-semibold text-foreground">2%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-destructive h-2 rounded-full" style={{ width: '2%' }} />
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-sm text-muted-foreground">Thành công: 2,680</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span className="text-sm text-muted-foreground">Cảnh báo: 108</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="text-sm text-muted-foreground">Lỗi: 59</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Requests */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold text-foreground mb-6">Yêu Cầu Gần Đây</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">ID Yêu Cầu</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Người Dùng</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Loại Tài Liệu</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Trạng Thái</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Thời Gian</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((item) => (
                    <tr key={item} className="border-b border-border hover:bg-secondary/30 transition">
                      <td className="px-4 py-3 text-sm text-foreground">REQ-{String(2024001 + item).padStart(4, '0')}</td>
                      <td className="px-4 py-3 text-sm text-foreground">Nguyễn Văn A</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">Sổ hộ nghèo</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                          Thành công
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">2 phút trước</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
