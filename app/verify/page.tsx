'use client'

import React from "react"
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Toast, { ToastType } from '@/components/Toast'
import LoadingSpinner from '@/components/LoadingSpinner'
import SupportCategorySelector from '@/components/SupportCategorySelector'
import LocationPicker from '@/components/LocationPicker'
import { Upload, AlertCircle, HelpCircle, CheckCircle, XCircle, Map, Shield, Eye, FileSearch, Fingerprint, Stamp, FileText, Loader, X, Lock, Clock } from 'lucide-react'
import Image from 'next/image'
import VietnamMap from '@/components/VietnamMap'
import { createClient } from '@/app/utils/supabase/client'
import { verifyImage, type VerifyResponse } from '@/lib/api'

interface LocationData {
  latitude: number
  longitude: number
  address?: string
  accuracy?: number
}

const PIPELINE_STEPS = [
  { icon: Eye, label: 'Kiểm tra độ mờ', desc: 'Phân tích chất lượng ảnh...' },
  { icon: FileSearch, label: 'Phân loại tài liệu', desc: 'Nhận dạng loại giấy tờ...' },
  { icon: Fingerprint, label: 'Kiểm tra độ tin cậy', desc: 'Đánh giá kết quả AI...' },
  { icon: Shield, label: 'Phát hiện giả mạo', desc: 'Kiểm tra tính xác thực...' },
  { icon: Stamp, label: 'Phát hiện con dấu', desc: 'Tìm kiếm dấu xác nhận...' },
  { icon: FileText, label: 'Trích xuất thông tin (OCR)', desc: 'Đọc nội dung tài liệu...' },
]

const STEP_DURATIONS = [500, 1500, 500, 3000, 1000, 2500]
const TOTAL_DURATION = STEP_DURATIONS.reduce((a, b) => a + b, 0)

function VerifyingOverlay({ isDone, onCancel }: { isDone: boolean; onCancel: () => void }) {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (isDone) { setProgress(100); setCurrentStep(PIPELINE_STEPS.length - 1); return }
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const percent = Math.min(95, (elapsed / TOTAL_DURATION) * 100)
      setProgress(percent)
      let cumulative = 0
      for (let i = 0; i < STEP_DURATIONS.length; i++) {
        cumulative += STEP_DURATIONS[i]
        if (elapsed < cumulative) { setCurrentStep(i); return }
      }
      setCurrentStep(PIPELINE_STEPS.length - 1)
    }, 100)
    return () => clearInterval(interval)
  }, [isDone])

  const circumference = 2 * Math.PI * 36
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-border relative">
        {!isDone && (
          <button type="button" onClick={onCancel} className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary transition text-muted-foreground hover:text-destructive" title="Hủy xác minh">
            <X size={20} />
          </button>
        )}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-24 h-24 mb-4">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-primary/20" />
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="text-primary transition-all duration-200 ease-out" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">{Math.round(progress)}%</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">Đang Xác Minh</h2>
          <p className="text-sm text-muted-foreground">Vui lòng chờ, không đóng trang này</p>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-200 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <div className="space-y-2">
          {PIPELINE_STEPS.map((step, idx) => {
            const Icon = step.icon
            const isActive = idx === currentStep && !isDone
            const isDone_ = idx < currentStep || isDone
            return (
              <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-300 ${isActive ? 'bg-primary/10 border border-primary/30' : isDone_ ? 'bg-success/10 border border-success/20' : 'bg-secondary/30 border border-transparent opacity-50'}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isActive ? 'bg-primary text-primary-foreground' : isDone_ ? 'bg-success text-white' : 'bg-muted text-muted-foreground'}`}>
                  {isDone_ ? <CheckCircle size={14} /> : <Icon size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? 'text-primary' : isDone_ ? 'text-success' : 'text-muted-foreground'}`}>{step.label}</p>
                  {isActive && <p className="text-xs text-muted-foreground animate-pulse">{step.desc}</p>}
                </div>
                {isActive && <div className="flex-shrink-0"><div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin"></div></div>}
              </div>
            )
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-5">Quá trình xác minh có thể mất 5-15 giây</p>
      </div>
    </div>
  )
}

async function resizeImageForPreview(file: File, maxDim: number = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = (height / width) * maxDim; width = maxDim }
          else { width = (width / height) * maxDim; height = maxDim }
        }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas context error')); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  const steps = [
    { num: 1, label: 'Xác minh tài liệu' },
    { num: 2, label: 'Xác định vị trí' },
    { num: 3, label: 'Chọn hỗ trợ' },
    { num: 4, label: 'Hoàn tất' },
  ]
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((s, idx) => {
        const isDone = currentStep > s.num
        const isActive = currentStep === s.num
        return (
          <div key={s.num} className="flex-1 flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${isDone ? 'bg-success text-white' : isActive ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : 'bg-secondary text-muted-foreground'}`}>
                {isDone ? <CheckCircle size={20} /> : s.num}
              </div>
              <p className={`text-xs mt-2 text-center font-medium ${isActive ? 'text-primary' : isDone ? 'text-success' : 'text-muted-foreground'}`}>{s.label}</p>
            </div>
            {idx < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 mb-6 transition ${isDone ? 'bg-success' : 'bg-border'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// Component hiển thị kết quả AI — xử lý cả success, pending, review, failed
function VerificationResult({ result }: { result: VerifyResponse }) {
  const isPending = result.status === 'pending'
  const isReview = result.result_type?.startsWith('review_') ?? false
  const isSuccess = result.success
  const isPendingOrReview = isPending || isReview

  if (isSuccess) {
    return (
      <div className="p-6 rounded-2xl border-2 bg-[#dcfce7] border-[#22c55e]">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 bg-[#dcfce7]">
            <CheckCircle className="text-[#22c55e]" size={28} strokeWidth={3} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-black mb-2 text-lg text-[#22c55e]">✓ Tài liệu hợp lệ</p>
            <p className="text-sm text-foreground">{result.message}</p>
            {result.confidence != null && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#22c55e]/20">
                <span className="text-xs font-semibold">Độ tin cậy:</span>
                <div className="flex-1 h-2.5 bg-gray-300 rounded-full overflow-hidden">
                  <div className="h-full bg-[#22c55e]" style={{ width: `${Math.min((result.confidence || 0) * 100, 100)}%` }} />
                </div>
                <span className="text-xs font-black text-[#22c55e]">{((result.confidence || 0) * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isPendingOrReview) {
    const color = isPending ? '#f59e0b' : '#3b82f6'
    const bgColor = isPending ? '#fef3c7' : '#dbeafe'
    const Icon = isPending ? Clock : Eye
    const title = isPending ? '⏳ Chờ xét duyệt thủ công' : '🔍 Cần xem xét thêm'

    return (
      <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: color, backgroundColor: bgColor }}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: bgColor }}>
              <Icon size={28} style={{ color }} strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-black mb-2 text-lg" style={{ color }}>{title}</p>
              <p className="text-sm text-foreground">{result.message}</p>
            </div>
          </div>
        </div>

        {/* Giải thích lý do */}
        <div className="px-6 pb-5">
          <div className="bg-white/60 rounded-xl p-4 border border-white/80">
            <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">Lý do chuyển xét duyệt</p>
            <p className="text-sm text-muted-foreground">
              {result.result_type === 'review_blur' && '📷 Con dấu hoặc chữ ký trong ảnh hơi mờ. Thay vì từ chối, hệ thống chuyển để nhân viên xem xét trực tiếp.'}
              {result.result_type === 'review_forgery' && '🛡️ Phát hiện dấu hiệu bất thường nhẹ — thường do chất lượng ảnh. Nhân viên sẽ xác nhận.'}
              {result.result_type === 'pending_forgery' && '⚠️ Có một số điểm cần kiểm tra thêm về tính xác thực của ảnh.'}
              {result.result_type === 'pending_no_stamp' && '🔎 Hệ thống không tìm thấy con dấu đỏ rõ ràng. Nhân viên sẽ kiểm tra trực tiếp.'}
              {result.result_type === 'pending_low_confidence' && '📊 Mức độ nhận diện ở ngưỡng biên — chưa đủ chắc chắn để tự động xác minh.'}
              {!result.result_type && 'Hồ sơ cần được xem xét thêm trước khi xác nhận.'}
            </p>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-muted-foreground">
                💡 <strong>Không cần làm gì thêm.</strong> Kết quả sẽ được cập nhật trong <strong>1–3 ngày làm việc</strong>.
              </p>
            </div>
          </div>

          {result.confidence != null && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-semibold text-muted-foreground">Độ tin cậy AI:</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((result.confidence || 0) * 100, 100)}%`, backgroundColor: color }} />
              </div>
              <span className="text-xs font-bold" style={{ color }}>{((result.confidence || 0) * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Failed
  return (
    <div className="p-6 rounded-2xl border-2 bg-[#fee2e2] border-[#ef4444]">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 bg-[#fee2e2]">
          <XCircle className="text-[#ef4444]" size={28} strokeWidth={3} />
        </div>
        <div className="flex-1 text-left">
          <p className="font-black mb-2 text-lg text-[#ef4444]">✗ Tài liệu không hợp lệ</p>
          <p className="text-sm text-foreground">{result.message}</p>
          {result.confidence != null && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#ef4444]/20">
              <span className="text-xs font-semibold">Độ tin cậy:</span>
              <div className="flex-1 h-2.5 bg-gray-300 rounded-full overflow-hidden">
                <div className="h-full bg-[#ef4444]" style={{ width: `${Math.min((result.confidence || 0) * 100, 100)}%` }} />
              </div>
              <span className="text-xs font-black text-[#ef4444]">{((result.confidence || 0) * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isPreparingPreview, setIsPreparingPreview] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerifyDone, setIsVerifyDone] = useState(false)
  const [backendResult, setBackendResult] = useState<VerifyResponse | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [location, setLocation] = useState<LocationData | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [mapRefreshKey, setMapRefreshKey] = useState(0)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [supabase] = useState(() => createClient())
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUser({ id: user.id, email: user.email })
    }
    getUser()
  }, [supabase])

  // Ảnh được xem là "pass bước 1" nếu success, pending, hoặc review
  const verifyPassed = backendResult && (backendResult.success || backendResult.status === 'pending' || backendResult.result_type?.startsWith('review_'))

  const currentStep: 1 | 2 | 3 | 4 =
    !verifyPassed ? 1 :
    !location ? 2 :
    selectedCategories.length === 0 ? 3 : 4

  const handleFileSelect = async (selectedFile: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/bmp']
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.type.startsWith('image/')) {
      setToast({ message: 'Vui lòng chọn tệp hình ảnh (JPG, PNG, BMP)', type: 'error' }); return
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setToast({ message: 'Kích thước tệp không được vượt quá 5MB', type: 'error' }); return
    }
    setFile(selectedFile); setBackendResult(null); setLocation(null); setSelectedCategories([])
    setIsPreparingPreview(true)
    try {
      const resizedPreview = await resizeImageForPreview(selectedFile, 800)
      setPreview(resizedPreview); setIsPreparingPreview(false)
      await verifyDocument(selectedFile)
    } catch (err) {
      setIsPreparingPreview(false)
      setToast({ message: 'Lỗi khi xử lý ảnh', type: 'error' })
    }
  }

  const verifyDocument = async (imageFile: File) => {
    setIsVerifying(true); setIsVerifyDone(false)
    abortControllerRef.current = new AbortController()
    try {
      const result = await verifyImage(imageFile, user?.id)
      setIsVerifyDone(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      setBackendResult(result)

      if (result.success) {
        setToast({ message: 'Xác minh thành công! Vui lòng xác định vị trí.', type: 'success' })
      } else if (result.status === 'pending') {
        setToast({ message: 'Hồ sơ chuyển chờ duyệt thủ công. Vui lòng hoàn tất các bước còn lại.', type: 'warning' })
      } else if (result.result_type?.startsWith('review_')) {
        setToast({ message: 'Tài liệu cần xem xét thêm. Vui lòng hoàn tất các bước còn lại.', type: 'info' })
      } else {
        setToast({ message: result.message || 'Tài liệu không hợp lệ.', type: 'error' })
      }
    } catch (error) {
      setIsVerifyDone(true)
      await new Promise(resolve => setTimeout(resolve, 300))
      if (error instanceof Error && error.name === 'AbortError') {
        setToast({ message: 'Đã hủy xác minh', type: 'info' })
      } else {
        const errMsg = error instanceof Error ? error.message : 'Lỗi kết nối server.'
        let displayMsg = errMsg
        if (errMsg.includes('API 500')) displayMsg = 'Lỗi server. Kiểm tra backend và database.'
        if (errMsg.includes('API 429')) displayMsg = 'Bạn đã vượt giới hạn 10 lần xác minh/ngày.'
        setToast({ message: displayMsg, type: 'error' })
      }
    } finally {
      setIsVerifying(false); setIsVerifyDone(false)
      abortControllerRef.current = null
    }
  }

  const handleCancelVerify = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    setFile(null); setPreview(null); setBackendResult(null); setIsVerifying(false); setIsVerifyDone(false)
    setToast({ message: 'Đã hủy xác minh', type: 'info' })
  }

  const handleChooseAnotherImage = () => {
    setFile(null); setPreview(null); setBackendResult(null); setLocation(null); setSelectedCategories([])
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0])
  }

  const handleFinalSubmit = async () => {
    if (!file || !verifyPassed || !location || selectedCategories.length === 0) {
      setToast({ message: 'Vui lòng hoàn thành tất cả các bước', type: 'error' }); return
    }
    setIsSubmitting(true)
    try {
      const result = await verifyImage(
        file, user?.id,
        { latitude: location.latitude, longitude: location.longitude, address: location.address },
        selectedCategories
      )

      // Chấp nhận cả success, pending, review
      if (result.success || result.status === 'pending' || result.result_type?.startsWith('review_')) {
        const codeMsg = result.data.verification_code ? ` Mã: ${result.data.verification_code}` : ''
        setToast({ message: `Đã ghi nhận hồ sơ!${codeMsg}`, type: 'success' })
        setMapRefreshKey(prev => prev + 1)
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
        setTimeout(() => { window.location.href = '/result' }, 1500)
      } else {
        setToast({ message: result.message || 'Có lỗi xảy ra.', type: 'error' })
      }
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Lỗi kết nối', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Header />
      {isVerifying && <VerifyingOverlay isDone={isVerifyDone} onCancel={handleCancelVerify} />}
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Xác Minh Tài Liệu</h1>
            <p className="text-muted-foreground">Thực hiện các bước theo thứ tự để nhận hỗ trợ</p>
            {user && (
              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" />Đã đăng nhập: {user.email}</span>
                <Link href="/history" className="text-primary hover:underline">Xem lịch sử</Link>
              </div>
            )}
          </div>

          <StepIndicator currentStep={currentStep} />

          <div className="bg-card border border-border rounded-xl p-8 mb-8 space-y-8">

            {/* BƯỚC 1: Upload */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">1</div>
                <h2 className="text-xl font-bold text-foreground">Xác minh tài liệu sổ hộ nghèo</h2>
              </div>

              <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'}`}>
                {isPreparingPreview ? (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <Loader size={48} className="animate-spin text-primary" />
                    <p className="font-semibold text-foreground">Đang xử lý ảnh...</p>
                  </div>
                ) : preview ? (
                  <div className="space-y-4">
                    <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border">
                      <Image src={preview || "/placeholder.svg"} alt="Preview" fill className="object-contain" />
                    </div>
                    <p className="text-sm text-muted-foreground">{file?.name}</p>
                    {backendResult && <VerificationResult result={backendResult} />}
                    <button type="button" onClick={handleChooseAnotherImage} className="text-primary hover:underline text-sm">
                      Chọn ảnh khác
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload size={48} className="mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-foreground mb-1">Kéo thả ảnh sổ hộ nghèo vào đây</p>
                      <p className="text-sm text-muted-foreground">hoặc</p>
                    </div>
                    <label>
                      <input type="file" accept="image/jpeg,image/png,image/bmp" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} className="hidden" />
                      <span className="cursor-pointer text-primary font-semibold hover:underline">chọn từ máy tính</span>
                    </label>
                    <p className="text-xs text-muted-foreground">JPG, PNG, BMP (tối đa 5MB)</p>
                  </div>
                )}
              </div>

              {!preview && (
                <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex gap-3">
                    <HelpCircle className="text-primary flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Hướng Dẫn</h3>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>✓ Chụp rõ ràng, không mờ</li>
                        <li>✓ Toàn bộ tài liệu trong khung hình</li>
                        <li>✓ Đủ ánh sáng, không bóng che</li>
                        <li>✓ Vuông góc với tài liệu</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* BƯỚC 2: Location */}
            <div className={`border-t border-border pt-8 transition ${!verifyPassed ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${verifyPassed ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  {!verifyPassed ? <Lock size={14} /> : '2'}
                </div>
                <h2 className="text-xl font-bold text-foreground">Xác định vị trí gia đình</h2>
              </div>
              {!verifyPassed ? (
                <div className="bg-secondary/30 rounded-lg p-4 flex items-center gap-3">
                  <Lock size={18} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Vui lòng hoàn thành bước 1 trước</p>
                </div>
              ) : (
                <LocationPicker onLocationChange={setLocation} required={true} />
              )}
            </div>

            {/* BƯỚC 3: Categories */}
            <div className={`border-t border-border pt-8 transition ${!location ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${location ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  {!location ? <Lock size={14} /> : '3'}
                </div>
                <h2 className="text-xl font-bold text-foreground">Chọn loại hỗ trợ cần thiết</h2>
              </div>
              {!location ? (
                <div className="bg-secondary/30 rounded-lg p-4 flex items-center gap-3">
                  <Lock size={18} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Vui lòng xác định vị trí ở bước 2 trước</p>
                </div>
              ) : (
                <SupportCategorySelector selected={selectedCategories} onChange={setSelectedCategories} />
              )}
            </div>

            {/* BƯỚC 4: Submit */}
            <div className="border-t border-border pt-8">
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={!file || !verifyPassed || !location || selectedCategories.length === 0 || isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
              >
                {isSubmitting ? (
                  <><LoadingSpinner /><span>Đang hoàn tất...</span></>
                ) : currentStep === 4 ? (
                  <><CheckCircle size={20} /><span>Hoàn Tất Đăng Ký Hỗ Trợ</span></>
                ) : (
                  <><Lock size={20} /><span>Hoàn thành các bước trên</span></>
                )}
              </button>

              {/* Hint khi pending/review */}
              {verifyPassed && backendResult && !backendResult.success && (
                <p className="text-center text-xs text-muted-foreground mt-3">
                  <Clock size={12} className="inline mr-1" />
                  Hồ sơ sẽ được chuyển sang xét duyệt thủ công sau khi hoàn tất
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">Được chấp nhận</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-success" /> Sổ hộ nghèo</li>
              </ul>
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">Không chấp nhận</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><XCircle size={16} className="text-destructive" /> Ảnh cá nhân, selfie</li>
                <li className="flex items-center gap-2"><XCircle size={16} className="text-destructive" /> Chứng chỉ, bằng cấp, CCCD</li>
              </ul>
            </div>
          </div>
        </div>

        <section className="py-12 border-t border-border mt-12">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg"><Map className="text-primary" size={24} /></div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Phân Bố Gia Đình Cần Hỗ Trợ</h2>
                <p className="text-sm text-muted-foreground">Mỗi chấm đỏ là một gia đình đã xác minh thành công</p>
              </div>
            </div>
            <VietnamMap key={mapRefreshKey} height="h-96" showStats={true} />
          </div>
        </section>
      </main>
      {toast && <div className="fixed bottom-4 right-4 z-50"><Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /></div>}
      <Footer />
    </>
  )
}