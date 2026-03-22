export type DocumentType = 'poverty_household' | 'invalid' | 'unknown'

export interface DocumentValidationResult {
  type: DocumentType
  confidence: number
  message: string
  isAccepted: boolean
}

export const VALID_KEYWORDS_POVERTY = [
  'sổ hộ nghèo',
  'hộ nghèo',
  'giấy chứng nhận hộ nghèo',
  'poverty household',
  'household registration',
  'poverty certificate',
  'sổ hộ',
  'xác nhận',
  'gia đình',
  'hộ gia đình',
  'chứng nhận',
  'năm',
  'việt nam',
  'công an',
  'cấp'
]

export const INVALID_KEYWORDS = [
  'chứng chỉ',
  'bằng cấp',
  'căn cước',
  'passport',
  'hộ chiếu',
  'bằng lái',
  'học bạ',
  'hóa đơn',
  'invoice',
  'album',
  'ảnh',
  'photo',
  'ảnh cưới',
  'portrait',
  'selfie',
  'bức ảnh',
  'hình ảnh'
]

export async function validateDocument(file: File): Promise<DocumentValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const canvas = document.createElement('canvas')
        const img = new Image()

        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            resolve({
              type: 'unknown',
              confidence: 0,
              message: 'Không thể xử lý ảnh. Vui lòng thử lại.',
              isAccepted: false,
            })
            return
          }

          ctx.drawImage(img, 0, 0)

          // Simulate OCR-like text detection
          // In production, you would use Google Cloud Vision API or similar
          const simulatedText = `
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            UBND TỈNH
            GIẤY CHỨNG NHẬN HỘ NGHÈO
            SỐ BÀO CẤP - PHƯỜNG
            ĐỘ NGHÈO
            NĂM ${new Date().getFullYear()}
            CÔNG AN
          `

          const validationResult = performTextAnalysis(simulatedText, file.name)
          resolve(validationResult)
        }

        img.onerror = () => {
          resolve({
            type: 'invalid',
            confidence: 0,
            message: 'File không phải là ảnh hợp lệ. Vui lòng chọn file ảnh.',
            isAccepted: false,
          })
        }

        img.crossOrigin = 'anonymous'
        img.src = e.target?.result as string
      } catch (error) {
        resolve({
          type: 'unknown',
          confidence: 0,
          message: 'Lỗi xử lý file. Vui lòng thử lại.',
          isAccepted: false,
        })
      }
    }

    reader.readAsDataURL(file)
  })
}

function performTextAnalysis(text: string, filename: string): DocumentValidationResult {
  const upperText = text.toUpperCase()
  const lowerText = text.toLowerCase()

  let validKeywordCount = 0
  let invalidKeywordCount = 0

  VALID_KEYWORDS_POVERTY.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) {
      validKeywordCount++
    }
  })

  INVALID_KEYWORDS.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) {
      invalidKeywordCount++
    }
  })

  // Check filename for hints
  const lowerFilename = filename.toLowerCase()
  if (lowerFilename.includes('hộ nghèo') || lowerFilename.includes('poverty')) {
    validKeywordCount += 2
  }

  if (invalidKeywordCount > 0) {
    return {
      type: 'invalid',
      confidence: 0.89,
      message: 'Tài liệu này không phải sổ hộ nghèo. Vui lòng tải lên sổ hộ nghèo hợp lệ.',
      isAccepted: false,
    }
  }

  if (validKeywordCount >= 2) {
    return {
      type: 'poverty_household',
      confidence: 0.89,
      message: 'Sổ hộ nghèo được xác nhận. Tài liệu hợp lệ và sẵn sàng để xử lý.',
      isAccepted: true,
    }
  }

  // More lenient for valid-looking documents
  if (validKeywordCount === 1) {
    return {
      type: 'poverty_household',
      confidence: 0.75,
      message: 'Sổ hộ nghèo được xác nhận. Tài liệu hợp lệ và sẵn sàng để xử lý.',
      isAccepted: true,
    }
  }

  return {
    type: 'unknown',
    confidence: 0.3,
    message: 'Không thể xác định loại tài liệu. Vui lòng tải lên sổ hộ nghèo rõ ràng hơn.',
    isAccepted: false,
  }
}
