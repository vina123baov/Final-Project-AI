export default function Footer() {
  return (
    <footer className="border-t border-border bg-background/80 backdrop-blur-sm mt-12">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary"></div>
              <span className="font-black text-foreground">VerifyFamily</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Hệ thống tích hợp thông tin gia đình với AI để hỗ trợ hoàn cảnh khó khăn hiệu quả.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-4">Điều hướng</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="/" className="text-muted-foreground hover:text-primary transition font-medium">Trang chủ</a></li>
              <li><a href="/verify" className="text-muted-foreground hover:text-primary transition font-medium">Xác minh & Bản đồ</a></li>
              <li><a href="/admin" className="text-muted-foreground hover:text-primary transition font-medium">Quản trị</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-4">Liên hệ</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-primary">✉</span>
                <span>support@verifyfamily.vn</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">☎</span>
                <span>+84 (0) 123 456 789</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-4">Giờ làm việc</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Thứ 2 - Thứ 6:</span><br/>
              8:00 - 17:00<br/>
              <span className="font-medium text-foreground">Thứ 7 - Chủ nhật:</span><br/>
              Đóng cửa
            </p>
          </div>
        </div>
        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between">
          <p className="text-sm text-muted-foreground">
            © 2024 VerifyFamily. Bảo lưu mọi quyền.
          </p>
          <div className="flex gap-8 mt-6 md:mt-0">
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition font-medium">Chính sách bảo mật</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition font-medium">Điều khoản sử dụng</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
