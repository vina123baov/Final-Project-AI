'use client'

import React from "react"
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Toast, { ToastType } from '@/components/Toast'
import LoadingSpinner from '@/components/LoadingSpinner'
import SupportCategorySelector from '@/components/SupportCategorySelector'
import LocationPicker from '@/components/LocationPicker'
import { Upload, AlertCircle, HelpCircle, CheckCircle, XCircle, Map } from 'lucide-react'
import Image from 'next/image'
import VietnamMapLive from '@/components/VietnamMap'
import { createClient } from '@/app/utils/supabase/client'
import { verifyImage, type VerifyResponse } from '@/lib/api'

interface LocationData {
  latitude: number
  longitude: number
  address?: string
  accuracy?: number
}

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [location, setLocation] = useState<LocationData | null>(null)
  const [backendResult, setBackendResult] = useState<VerifyResponse | null>(null)
  const [mapRefreshKey, setMapRefreshKey] = useState(0)

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUser({ id: user.id, email: user.email })
    }
    getUser()
  }, [supabase])

  const handleFileSelect = async (selectedFile: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/bmp']
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.type.startsWith('image/')) {
      setToast({ message: 'Vui lòng chọn tệp hình ảnh (JPG, PNG, BMP)', type: 'error' })
      return
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setToast({ message: 'Kích thước tệp không được vượt quá 5MB', type: 'error' })
      return
    }

    setFile(selectedFile)
    setBackendResult(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => { setIsDragging(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0])
  }

  // Submit -> goi backend Django (pipeline AI)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setToast({ message: 'Vui lòng chọn một ảnh', type: 'error' }); return }
    if (selectedCategories.length === 0) { setToast({ message: 'Vui lòng chọn ít nhất một loại tiếp tế', type: 'error' }); return }
    if (!location) { setToast({ message: 'Vui lòng xác định vị trí của bạn', type: 'error' }); return }

    setIsLoading(true)
    setBackendResult(null)

    try {
      const result = await verifyImage(
        file,
        user?.id,
        { latitude: location.latitude, longitude: location.longitude, address: location.address }
      )
      setBackendResult(result)

      if (result.success) {
        setToast({ message: `Xác minh thành công! Mã: ${result.data.verification_code || ''}`, type: 'success' })
        // Refresh map de hien thi diem moi
        setMapRefreshKey(prev => prev + 1)

        // Luu session va chuyen trang
        sessionStorage.setItem('verificationData', JSON.stringify({
          id: result.data.id,
          verification_code: result.data.verification_code,
          location, selectedCategories,
          confidence: result.confidence,
          status: result.status,
          result_type: result.result_type,
          extracted_text: result.data.extracted_text,
          household_name: result.data.household_name,
          household_address: result.data.household_address,
          processing_time_ms: result.data.processing_time_ms,
          timestamp: new Date().toISOString(),
        }))
        setTimeout(() => { window.location.href = '/result' }, 2000)
      } else {
        setToast({ message: result.message || 'Xác minh thất bại. Vui lòng thử lại.', type: 'error' })
      }
    } catch (error) {
      console.error('Verification error:', error)
      const errMsg = error instanceof Error ? error.message : 'Lỗi kết nối server.'
      // Parse error message from API response
      let displayMsg = errMsg
      if (errMsg.includes('API 500')) {
        displayMsg = 'Lỗi server. Vui lòng kiểm tra backend đang chạy và database đã đúng cấu trúc.'
      }
      setToast({ message: displayMsg, type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Xác Minh Tài Liệu</h1>
            <p className="text-muted-foreground">Tải lên ảnh sổ hộ nghèo để xác minh và nhận hỗ trợ</p>
            {user && (
              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" />Đã đăng nhập: {user.email}</span>
                <Link href="/history" className="text-primary hover:underline">Xem lịch sử</Link>
              </div>
            )}
            {!user && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle size={16} className="text-yellow-600 flex-shrink-0" />
                <span className="text-yellow-800 dark:text-yellow-200">
                  <Link href="/login" className="font-semibold underline">Đăng nhập</Link> để lưu lịch sử xác minh.
                </span>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Upload Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'}`}
              >
                {preview ? (
                  <div className="space-y-4">
                    <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border">
                      <Image src={preview || "/placeholder.svg"} alt="Preview" fill className="object-contain" />
                    </div>
                    <p className="text-sm text-muted-foreground">{file?.name}</p>

                    {/* Ket qua tu backend */}
                    {backendResult && (
                      <div className={`p-6 rounded-2xl border-2 transition-all ${
                        backendResult.success
                          ? 'bg-[#dcfce7] border-[#22c55e] shadow-lg shadow-[#22c55e]/20'
                          : 'bg-[#fee2e2] border-[#ef4444] shadow-lg shadow-[#ef4444]/20'
                      }`}>
                        <div className="flex items-start gap-4">
                          {backendResult.success ? (
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#dcfce7] flex-shrink-0">
                              <CheckCircle className="text-[#22c55e]" size={28} strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#fee2e2] flex-shrink-0">
                              <XCircle className="text-[#ef4444]" size={28} strokeWidth={3} />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className={`font-black mb-2 text-lg ${backendResult.success ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                              {backendResult.success ? '✓ Tài liệu hợp lệ' : '✗ Tài liệu không hợp lệ'}
                            </p>
                            <p className="text-sm text-foreground leading-relaxed">{backendResult.message}</p>

                            {backendResult.confidence !== null && backendResult.confidence !== undefined && (
                              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-current border-opacity-20">
                                <span className="text-xs font-semibold text-foreground">Độ tin cậy:</span>
                                <div className="flex-1 h-2.5 bg-gray-300 rounded-full overflow-hidden">
                                  <div className={`h-full ${backendResult.success ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} style={{ width: `${Math.min((backendResult.confidence || 0) * 100, 100)}%` }} />
                                </div>
                                <span className={`text-xs font-black ${backendResult.success ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                                  {((backendResult.confidence || 0) * 100).toFixed(0)}%
                                </span>
                              </div>
                            )}

                            {backendResult.data.processing_time_ms && (
                              <p className="text-xs text-muted-foreground mt-2">Thời gian xử lý: {backendResult.data.processing_time_ms}ms</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <button type="button" onClick={() => { setFile(null); setPreview(null); setBackendResult(null) }} className="text-primary hover:underline text-sm">
                      Chọn ảnh khác
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload size={48} className="mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-foreground mb-1">Kéo thả ảnh vào đây</p>
                      <p className="text-sm text-muted-foreground">hoặc</p>
                    </div>
                    <label>
                      <input type="file" accept="image/jpeg,image/png,image/bmp" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} className="hidden" />
                      <span className="cursor-pointer text-primary font-semibold hover:underline">chọn từ máy tính</span>
                    </label>
                    <p className="text-xs text-muted-foreground">Định dạng: JPG, PNG, BMP (Kích thước tối đa: 5MB)</p>
                  </div>
                )}
              </div>

              {/* Huong dan */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex gap-3">
                  <HelpCircle className="text-primary flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Hướng Dẫn Chụp Ảnh</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ Chụp ảnh rõ ràng, không bị mờ hoặc nhòe</li>
                      <li>✓ Đảm bảo toàn bộ tài liệu nằm trong khung hình</li>
                      <li>✓ Ánh sáng đủ và không có bóng che phủ</li>
                      <li>✓ Giữ ảnh vuông góc với tài liệu</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Vi tri */}
              <LocationPicker onLocationChange={setLocation} required={true} />

              {/* Vat dung tiep te */}
              <SupportCategorySelector selected={selectedCategories} onChange={setSelectedCategories} />

              {/* Nut xac minh */}
              <button
                type="submit"
                disabled={!file || isLoading || selectedCategories.length === 0 || !location}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (<><LoadingSpinner /><span>Đang xác minh...</span></>) : ('Xác Minh Ngay')}
              </button>
            </form>
          </div>

          {/* Thong tin */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">Tài liệu được chấp nhận</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-success" /> Sổ hộ nghèo</li>
              </ul>
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">Tài liệu không được chấp nhận</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><XCircle size={16} className="text-destructive" /> Ảnh cá nhân, selfie</li>
                <li className="flex items-center gap-2"><XCircle size={16} className="text-destructive" /> Chứng chỉ, bằng cấp</li>
                <li className="flex items-center gap-2"><XCircle size={16} className="text-destructive" /> Căn cước, hộ chiếu</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Ban do Vietnam - hien thi diem do khi xac minh thanh cong */}
        <section className="py-12 border-t border-border mt-12">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg"><Map className="text-primary" size={24} /></div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Phân Bố Gia Đình Cần Hỗ Trợ</h2>
                <p className="text-sm text-muted-foreground">Mỗi chấm đỏ là một gia đình đã xác minh thành công</p>
              </div>
            </div>
            <VietnamMapLive key={mapRefreshKey} height="h-96" />
          </div>
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
      <Footer />
    </>
  )
}