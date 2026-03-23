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
import VietnamMap from '@/components/VietnamMap'
import { validateDocument, DocumentValidationResult } from '@/lib/documentValidator'
import { createClient } from '@/app/utils/supabase/client'

// ============================================================================
// TYPES - khop voi database schema (Bang 2.3 + ERD Hinh 2.3)
// ============================================================================

interface LocationData {
  latitude: number
  longitude: number
  address?: string
  accuracy?: number
}

// Khop voi ENUM verification_status trong database
type VerificationStatus = 'pending' | 'success' | 'failed'

// Khop voi ENUM result_type_enum trong database
type ResultType = 'blur' | 'invalid' | 'wrong_doc' | 'low_confidence' | 'success'

// Khop voi ENUM document_class trong database
type DocumentClass = 'so_ho_ngheo' | 'giay_to_khac' | 'anh_khong_lien_quan'

// Khop voi cau truc bang verification_requests (Bang 2.3 + Pipeline Section 2.4.1)
interface VerificationRequestInsert {
  user_id: string
  image_path?: string
  image_storage_path?: string
  original_filename?: string
  status: VerificationStatus
  result_type?: ResultType
  blur_score?: number | null
  is_blurry?: boolean
  predicted_class?: DocumentClass
  confidence?: number
  passed_confidence_check?: boolean
  extracted_text?: string | null
  ocr_confidence?: number
  household_name?: string
  household_address?: string
  household_id_number?: string
  province?: string
  user_latitude?: number
  user_longitude?: number
  user_location_address?: string
  processing_time_ms?: number
  message?: string
  need_retry?: boolean
  verification_code?: string
  expires_at?: string
  verified_at?: string
}

// ============================================================================
// SUPABASE HELPERS
// ============================================================================

/**
 * Upload anh len Supabase Storage bucket "verification-images"
 * Theo Hinh 4.2: JPG, PNG, BMP, max 5MB
 */
async function uploadImage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  file: File
): Promise<{ path: string; error: string | null }> {
  const fileExt = file.name.split('.').pop()?.toLowerCase()
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('verification-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    return { path: '', error: error.message }
  }

  return { path: data.path, error: null }
}

/**
 * Tao verification request trong database
 * Khop voi Bang 2.3 (VerificationRequest) + Pipeline Section 2.4.1
 */
async function createVerificationRequest(
  supabase: ReturnType<typeof createClient>,
  request: VerificationRequestInsert
) {
  const { data, error } = await supabase
    .from('verification_requests')
    .insert(request)
    .select()
    .single()

  return { data, error }
}

/**
 * Ghi audit log
 * Theo YC 2.1.2: Bao mat - ghi log hoat dong
 */
async function logAudit(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  action: string,
  details?: Record<string, unknown>
) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    entity_type: 'verification_requests',
    details,
  })
}

/**
 * Generate verification code
 * Theo ERD (Hinh 2.3): verification_code field
 */
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'VF-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function VerifyPage() {
  // --- State ---
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [location, setLocation] = useState<LocationData | null>(null)
  const [validationResult, setValidationResult] = useState<DocumentValidationResult | null>(null)

  // Supabase state
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [supabase] = useState(() => createClient())
  const [historyCount, setHistoryCount] = useState<number>(0)

  // --- Auth: lay user hien tai ---
  // UC02: Dang nhap - kiem tra auth state
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser({ id: user.id, email: user.email })

        // UC05: Dem so lan xac minh truoc do
        const { count } = await supabase
          .from('verification_requests')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        
        setHistoryCount(count || 0)
      }
    }
    getUser()
  }, [supabase])

  // --- File handling ---
  const handleFileSelect = async (selectedFile: File) => {
    // Kiem tra dinh dang (Hinh 4.2: JPG, PNG, BMP)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/bmp']
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.type.startsWith('image/')) {
      setToast({ message: 'Vui lòng chọn tệp hình ảnh (JPG, PNG, BMP)', type: 'error' })
      return
    }

    // Kiem tra kich thuoc (Hinh 4.2: max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setToast({ message: 'Kích thước tệp không được vượt quá 5MB', type: 'error' })
      return
    }

    setFile(selectedFile)
    setValidationResult(null)
    
    const reader = new FileReader()
    reader.onload = async (e) => {
      setPreview(e.target?.result as string)
      
      // Pipeline Buoc 1-3: Validate document (blur + classification + confidence)
      const result = await validateDocument(selectedFile)
      setValidationResult(result)
      
      if (!result.isAccepted) {
        setToast({ message: result.message, type: 'error' })
        setFile(null)
      } else {
        setToast({ message: result.message, type: 'success' })
      }
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  // --- Submit: tich hop Supabase ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file) {
      setToast({ message: 'Vui lòng chọn một ảnh', type: 'error' })
      return
    }

    if (selectedCategories.length === 0) {
      setToast({ message: 'Vui lòng chọn ít nhất một loại tiếp tế', type: 'error' })
      return
    }

    if (!location) {
      setToast({ message: 'Vui lòng xác định vị trí của bạn', type: 'error' })
      return
    }

    if (!user) {
      setToast({ message: 'Vui lòng đăng nhập để xác minh', type: 'error' })
      return
    }

    setIsLoading(true)
    const startTime = performance.now()

    try {
      // ============================================================
      // BUOC 1: Upload anh len Supabase Storage
      // ============================================================
      const { path: storagePath, error: uploadError } = await uploadImage(supabase, user.id, file)
      
      if (uploadError) {
        throw new Error(`Upload lỗi: ${uploadError}`)
      }

      // ============================================================
      // BUOC 2: Tao verification request (status = pending)
      // Khop voi Bang 2.3 + ERD Hinh 2.3
      // ============================================================
      const verificationCode = generateVerificationCode()
      const processingTime = Math.round(performance.now() - startTime)

      // Map validation result to database enums
      let resultType: ResultType = 'success'
      let predictedClass: DocumentClass = 'so_ho_ngheo'
      let status: VerificationStatus = 'success'

      if (validationResult) {
        if (!validationResult.isAccepted) {
          status = 'failed'
          // Map validation type to result_type enum
          if (validationResult.confidence < 0.7) {
            resultType = 'low_confidence'
          } else {
            resultType = 'invalid'
          }
        } else {
          status = 'success'
          resultType = 'success'
          predictedClass = 'so_ho_ngheo'
        }
      }

      const requestData: VerificationRequestInsert = {
        user_id: user.id,
        
        // Bang 2.3 fields
        image_path: file.name,
        status,
        result_type: resultType,
        confidence: validationResult?.confidence ?? 0,
        blur_score: null,           // Se duoc backend AI pipeline tinh (Section 1.5.2)
        extracted_text: null,       // Se duoc VietOCR xu ly (Section 1.4.2)
        
        // ERD (Hinh 2.3) fields
        verification_code: verificationCode,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 ngay
        verified_at: status === 'success' ? new Date().toISOString() : undefined,
        
        // Pipeline (Section 2.4.1) fields
        image_storage_path: storagePath,
        original_filename: file.name,
        is_blurry: false,           // Se duoc backend AI pipeline tinh (Laplacian Variance < 100)
        predicted_class: predictedClass,
        passed_confidence_check: (validationResult?.confidence ?? 0) >= 0.7,
        
        // Vi tri (Hinh 4.2)
        user_latitude: location.latitude,
        user_longitude: location.longitude,
        user_location_address: location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
        
        // Thoi gian xu ly (YC 2.1.2: < 5 giay)
        processing_time_ms: processingTime,
        
        // Thong bao (Phu luc A.3: MESSAGES)
        message: validationResult?.isAccepted 
          ? 'Xac minh thanh cong!' 
          : validationResult?.message ?? 'Loi xac minh',
        need_retry: !validationResult?.isAccepted,
      }

      const { data: verificationRecord, error: insertError } = await createVerificationRequest(supabase, requestData)

      if (insertError) {
        throw new Error(`Lỗi lưu dữ liệu: ${insertError.message}`)
      }

      // ============================================================
      // BUOC 3: Ghi audit log (YC 2.1.2: Bao mat)
      // ============================================================
      await logAudit(supabase, user.id, 'upload_verify', {
        verification_id: verificationRecord?.id,
        verification_code: verificationCode,
        result_type: resultType,
        confidence: validationResult?.confidence,
        processing_time_ms: processingTime,
        categories: selectedCategories,
      })

      // ============================================================
      // BUOC 4: Luu data cho trang ket qua + ban do
      // ============================================================
      const verificationData = {
        id: verificationRecord?.id,
        verification_code: verificationCode,
        location,
        selectedCategories,
        confidence: validationResult?.confidence,
        status,
        result_type: resultType,
        timestamp: new Date().toISOString(),
      }
      sessionStorage.setItem('verificationData', JSON.stringify(verificationData))

      // ============================================================
      // THANH CONG
      // ============================================================
      setToast({ message: `Xác minh thành công! Mã: ${verificationCode}`, type: 'success' })
      
      setTimeout(() => {
        window.location.href = '/result'
      }, 1500)

    } catch (error) {
      console.error('Verification error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Lỗi xác minh. Vui lòng thử lại.'
      setToast({ message: errorMessage, type: 'error' })

      // Log loi
      await logAudit(supabase, user.id, 'upload_verify_error', {
        error: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // --- Render ---
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Xác Minh Tài Liệu</h1>
            <p className="text-muted-foreground">Tải lên ảnh sổ hộ nghèo của bạn để xác minh thông tin</p>
            
            {/* Hien thi thong tin user + so lan xac minh (UC05) */}
            {user && (
              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-green-500" />
                  Đã đăng nhập: {user.email}
                </span>
                {historyCount > 0 && (
                  <Link href="/history" className="text-primary hover:underline">
                    Lịch sử: {historyCount} lần xác minh
                  </Link>
                )}
              </div>
            )}

            {/* Canh bao chua dang nhap */}
            {!user && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle size={16} className="text-yellow-600 flex-shrink-0" />
                <span className="text-yellow-800 dark:text-yellow-200">
                  Vui lòng{' '}
                  <Link href="/login" className="font-semibold underline">đăng nhập</Link>
                  {' '}để xác minh và lưu lịch sử.
                </span>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="bg-card border border-border rounded-xl p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Upload Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary'
                }`}
              >
                {preview ? (
                  <div className="space-y-4">
                    <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border">
                      <Image
                        src={preview || "/placeholder.svg"}
                        alt="Preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">{file?.name}</p>
                    
                    {/* Validation Result - Pipeline Section 2.4.1 */}
                    {validationResult && (
                      <div className={`p-6 rounded-2xl border-2 transition-all ${
                        validationResult.isAccepted 
                          ? 'bg-[#dcfce7] border-[#22c55e] shadow-lg shadow-[#22c55e]/20' 
                          : 'bg-[#fee2e2] border-[#ef4444] shadow-lg shadow-[#ef4444]/20'
                      }`}>
                        <div className="flex items-start gap-4">
                          {validationResult.isAccepted ? (
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#dcfce7] flex-shrink-0">
                              <CheckCircle className="text-[#22c55e]" size={28} strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#fee2e2] flex-shrink-0">
                              <XCircle className="text-[#ef4444]" size={28} strokeWidth={3} />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className={`font-black mb-2 text-lg ${
                              validationResult.isAccepted ? 'text-[#22c55e]' : 'text-[#ef4444]'
                            }`}>
                              {validationResult.isAccepted ? '✓ Tài liệu hợp lệ' : '✗ Tài liệu không hợp lệ'}
                            </p>
                            <p className="text-sm text-foreground leading-relaxed">{validationResult.message}</p>
                            
                            {/* Confidence bar - Section 4.3.3: threshold 0.7 */}
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-current border-opacity-20">
                              <span className="text-xs font-semibold text-foreground">Độ tin cậy:</span>
                              <div className="flex-1 h-2.5 bg-gray-300 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${validationResult.isAccepted ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
                                  style={{ width: `${Math.min(validationResult.confidence * 100, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-black ${validationResult.isAccepted ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                                {(validationResult.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null)
                        setPreview(null)
                        setValidationResult(null)
                      }}
                      className="text-primary hover:underline text-sm"
                    >
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
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/bmp"
                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        className="hidden"
                      />
                      <span className="cursor-pointer text-primary font-semibold hover:underline">
                        chọn từ máy tính
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Định dạng: JPG, PNG, BMP (Kích thước tối đa: 5MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Guidelines - Hinh 4.2 */}
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

              {/* Location Picker - Hinh 4.2: Vi Tri Gia Dinh */}
              <LocationPicker
                onLocationChange={setLocation}
                required={true}
              />

              {/* Support Categories */}
              <SupportCategorySelector
                selected={selectedCategories}
                onChange={setSelectedCategories}
              />

              {/* Submit button */}
              <button
                type="submit"
                disabled={!file || isLoading || !validationResult?.isAccepted || selectedCategories.length === 0 || !location || !user}
                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner />
                    <span>Đang xác minh...</span>
                  </>
                ) : !user ? (
                  'Đăng nhập để Xác Minh'
                ) : (
                  'Xác Minh Ngay'
                )}
              </button>
            </form>
          </div>

          {/* Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">Tài liệu được chấp nhận</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-success" /> Sổ hộ nghèo</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">Chỉ chấp nhận Sổ Hộ Nghèo</p>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">Tài liệu không được chấp nhận</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><XCircle size={16} className="text-destructive" /> Ảnh cá nhân, selfie</li>
                <li className="flex items-center gap-2"><XCircle size={16} className="text-destructive" /> Chứng chỉ, bằng cấp</li>
                <li className="flex items-center gap-2"><XCircle size={16} className="text-destructive" /> Căn cước, hộ chiếu</li>
              </ul>
            </div>
            <div className="bg-secondary/30 border border-border rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-2">Thời gian xử lý</h3>
              <p className="text-sm text-muted-foreground">
                Hầu hết các yêu cầu sẽ được xử lý trong vòng 2-3 giây
              </p>
            </div>
          </div>

          {/* Security notice - YC 2.1.2 */}
          <div className="mt-8 p-4 bg-warning/10 border border-warning/20 rounded-lg flex gap-3">
            <AlertCircle className="text-warning flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">Lưu ý bảo mật:</strong> Tất cả ảnh được mã hóa và chỉ được sử dụng cho mục đích xác minh. 
              Dữ liệu được bảo vệ bằng Row Level Security - bạn chỉ có thể xem dữ liệu của chính mình.
            </div>
          </div>
        </div>

        {/* Vietnam Map */}
        <section className="py-12 border-t border-border mt-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Map className="text-primary" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Phân Bố Gia Đình Cần Hỗ Trợ</h2>
                <p className="text-sm text-muted-foreground">Theo dõi vị trí các gia đình đang cần hỗ trợ trên toàn Việt Nam</p>
              </div>
            </div>
            <VietnamMap height="h-96" showStats={true} />
          </div>
        </section>
      </main>

      {/* Toast */}
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