import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function NotFoundPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-9xl font-bold text-primary mb-4">404</h1>
          <h2 className="text-3xl font-bold text-foreground mb-2">Không Tìm Thấy Trang</h2>
          <p className="text-muted-foreground mb-8">
            Trang bạn đang tìm không tồn tại hoặc đã bị xóa.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition"
          >
            Quay Về Trang Chủ
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
