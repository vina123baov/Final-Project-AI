export type DocumentType = 'poverty_household' | 'invalid' | 'unknown'

export interface DocumentValidationResult {
  type: DocumentType
  confidence: number
  message: string
  isAccepted: boolean
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Goi backend AI pipeline de validate document
 * Pipeline 5 buoc: Blur Detection -> Classification -> Confidence Check -> Class Handling -> OCR
 */
export async function validateDocument(file: File): Promise<DocumentValidationResult> {
  try {
    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`${API_URL}/api/verify/`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend error:', response.status, errorText)
      return {
        type: 'unknown',
        confidence: 0,
        message: `Lỗi kết nối server (${response.status}). Vui lòng thử lại.`,
        isAccepted: false,
      }
    }

    const data = await response.json()

    // Map backend response to frontend validation result
    // Backend returns: status, result_type, confidence, predicted_class, message, etc.
    
    const confidence = data.confidence ?? 0
    const resultType = data.result_type ?? 'invalid'
    const predictedClass = data.predicted_class ?? 'anh_khong_lien_quan'
    const isSuccess = data.status === 'success' && resultType === 'success'

    let type: DocumentType = 'unknown'
    let message = data.message || 'Không thể xác định tài liệu.'

    if (isSuccess && predictedClass === 'so_ho_ngheo') {
      type = 'poverty_household'
      message = message || 'Sổ hộ nghèo được xác nhận. Tài liệu hợp lệ và sẵn sàng để xử lý.'
    } else if (predictedClass === 'giay_to_khac') {
      type = 'invalid'
      message = message || 'Tài liệu này không phải sổ hộ nghèo. Vui lòng tải lên sổ hộ nghèo hợp lệ.'
    } else if (predictedClass === 'anh_khong_lien_quan') {
      type = 'invalid'
      message = message || 'Ảnh không liên quan đến tài liệu. Vui lòng tải lên ảnh sổ hộ nghèo.'
    } else if (resultType === 'blur') {
      type = 'unknown'
      message = message || 'Ảnh bị mờ. Vui lòng chụp ảnh rõ ràng hơn.'
    } else if (resultType === 'low_confidence') {
      type = 'unknown'
      message = message || 'Không thể xác định rõ loại tài liệu. Vui lòng chụp ảnh rõ hơn.'
    } else {
      type = 'invalid'
    }

    return {
      type,
      confidence,
      message,
      isAccepted: isSuccess,
    }

  } catch (error) {
    console.error('Validation error:', error)
    
    // Kiem tra neu backend khong chay
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: 'unknown',
        confidence: 0,
        message: 'Không thể kết nối đến server AI. Hãy đảm bảo backend đang chạy tại ' + API_URL,
        isAccepted: false,
      }
    }

    return {
      type: 'unknown',
      confidence: 0,
      message: 'Lỗi xử lý ảnh. Vui lòng thử lại.',
      isAccepted: false,
    }
  }
}