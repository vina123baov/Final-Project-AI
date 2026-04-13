import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import AuthGuard from '@/components/AuthGuard'

import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VerifyFamily - Xác Minh Hoàn Cảnh Gia Đình',
  description: 'VerifyFamily - Hệ thống tích hợp thông tin gia đình với AI để thu thập và xác minh hoàn cảnh khó khăn.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  )
}