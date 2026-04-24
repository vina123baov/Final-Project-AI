'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CheckCircle, Zap, Shield, BarChart3 } from 'lucide-react'

export default function Page() {
  return (
    <>
      <Header />
      <main className="bg-background overflow-hidden">
        {/* Hero Section */}
        <section className="relative py-40 px-4 gradient-accent overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
          </div>
          
          <div className="container mx-auto text-center relative z-10">
            <div className="inline-block mb-6 px-4 py-2 bg-white/15 rounded-full backdrop-blur-sm border border-white/20">
              <span className="text-white text-sm font-semibold tracking-wide">Hỗ trợ xã hội thông minh</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black text-white mb-8 text-pretty leading-tight">
              AuraFamily
            </h1>
            <p className="text-xl text-white/85 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
              Nền tảng tích hợp thông tin gia đình để xác định và hỗ trợ hoàn cảnh khó khăn một cách nhanh chóng, chính xác và bảo mật.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/verify"
                className="px-8 py-4 bg-white text-primary font-bold rounded-xl hover:shadow-2xl hover:-translate-y-1 transition-all inline-block"
              >
                Bắt Đầu Hỗ Trợ
              </Link>
              <Link
                href="/login"
                className="px-8 py-4 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-all inline-block"
              >
                Đăng Nhập
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-32 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-4">Tính Năng Nổi Bật</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Những tính năng mạnh mẽ giúp hỗ trợ gia đình khó khăn hiệu quả</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="group bg-card border border-border rounded-2xl p-8 card-hover hover:border-primary/50">
                <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 mb-6 transition-all">
                  <Zap className="text-primary" size={28} />
                </div>
                <h3 className="font-bold text-foreground mb-3 text-lg">Xử Lý Nhanh</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Kết quả xác minh trong vòng vài giây với công nghệ OCR tối ưu
                </p>
              </div>

              <div className="group bg-card border border-border rounded-2xl p-8 card-hover hover:border-success/50">
                <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-success/20 to-success/10 group-hover:from-success/30 group-hover:to-success/20 mb-6 transition-all">
                  <CheckCircle className="text-success" size={28} />
                </div>
                <h3 className="font-bold text-foreground mb-3 text-lg">Độ Chính Xác Cao</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Nhận diện ký tự với độ chính xác trên 95% thông qua AI
                </p>
              </div>

              <div className="group bg-card border border-border rounded-2xl p-8 card-hover hover:border-primary/50">
                <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 mb-6 transition-all">
                  <Shield className="text-primary" size={28} />
                </div>
                <h3 className="font-bold text-foreground mb-3 text-lg">An Toàn Cao</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Mã hóa dữ liệu end-to-end và tuân thủ các tiêu chuẩn bảo mật
                </p>
              </div>

              <div className="group bg-card border border-border rounded-2xl p-8 card-hover hover:border-secondary/50">
                <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 group-hover:from-secondary/30 group-hover:to-secondary/20 mb-6 transition-all">
                  <BarChart3 className="text-secondary" size={28} />
                </div>
                <h3 className="font-bold text-foreground mb-3 text-lg">Quản Lý Dễ Dàng</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Xem lịch sử xác minh và thống kê chi tiết trong dashboard
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-32 px-4 bg-gradient-to-b from-secondary/15 to-primary/5">
          <div className="container mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-4">Cách Hoạt Động</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Quy trình đơn giản chỉ vài bước để bắt đầu</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="relative text-center">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary text-white font-black text-3xl mx-auto mb-6">
                  1
                </div>
                <h3 className="font-bold text-foreground mb-3 text-lg">Tải Ảnh</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tải lên ảnh sổ hộ nghèo hoặc chứng minh thư của bạn
                </p>
              </div>

              <div className="relative text-center">
                <div className="absolute -left-4 top-8 w-8 h-0.5 bg-gradient-to-r from-primary/30 to-transparent hidden md:block"></div>
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary text-white font-black text-3xl mx-auto mb-6">
                  2
                </div>
                <h3 className="font-bold text-foreground mb-3 text-lg">Xử Lý OCR</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Hệ thống sẽ phân tích và trích xuất thông tin từ ảnh
                </p>
              </div>

              <div className="relative text-center">
                <div className="absolute -left-4 top-8 w-8 h-0.5 bg-gradient-to-r from-primary/30 to-transparent hidden md:block"></div>
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary text-white font-black text-3xl mx-auto mb-6">
                  3
                </div>
                <h3 className="font-bold text-foreground mb-3 text-lg">Nhận Kết Quả</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Lưu lại kết quả xác minh và lịch sử trong tài khoản của bạn
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-4 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl"></div>
          </div>
          
          <div className="container mx-auto bg-gradient-to-br from-primary via-primary to-secondary rounded-3xl p-16 text-center text-white relative z-10">
            <h2 className="text-4xl md:text-5xl font-black mb-6">Sẵn Sàng Bắt Đầu?</h2>
            <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto leading-relaxed">
              Tạo tài khoản ngay hôm nay và bắt đầu nhận hỗ trợ từ VerifyFamily
            </p>
            <Link
              href="/register"
              className="inline-block px-10 py-4 bg-white text-primary font-bold rounded-xl hover:shadow-2xl hover:-translate-y-1 transition-all"
            >
              Đăng Ký Miễn Phí
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
