// API utility functions for backend integration
// Currently returns mock data for demonstration

export const api = {
  // Auth endpoints
  login: async (email: string, password: string) => {
    return { success: true, token: 'mock-token' }
  },

  register: async (userData: {
    fullName: string
    email: string
    phone: string
    password: string
  }) => {
    return { success: true, userId: 'USER-001' }
  },

  // Verification endpoints
  uploadDocument: async (file: File) => {
    return { success: true, documentId: 'DOC-001' }
  },

  verifyDocument: async (documentId: string) => {
    return {
      success: true,
      status: 'success',
      confidence: 98.5,
      data: {
        fullName: 'Nguyễn Văn A',
        idNumber: '123456789',
        yearOfBirth: '1985',
        address: 'Xã Thanh Lâm, Huyện Hạ Hòa, Phú Thọ',
      },
    }
  },

  // History endpoints
  getVerificationHistory: async (page: number = 1) => {
    return {
      success: true,
      data: [],
      total: 0,
      page,
    }
  },

  getVerificationDetail: async (id: string) => {
    return {
      success: true,
      data: {
        id,
        status: 'success',
        confidence: 98.5,
        createdAt: new Date().toISOString(),
      },
    }
  },

  // Admin endpoints
  getDashboardStats: async () => {
    return {
      success: true,
      totalRequests: 2847,
      successRate: 94.2,
      activeUsers: 512,
      failedRequests: 167,
    }
  },

  getUsers: async (page: number = 1) => {
    return {
      success: true,
      data: [],
      total: 0,
      page,
    }
  },

  getPendingRequests: async () => {
    return {
      success: true,
      data: [],
    }
  },

  approveRequest: async (requestId: string) => {
    return { success: true }
  },

  rejectRequest: async (requestId: string, reason: string) => {
    return { success: true }
  },
}

// Error handler
export const handleApiError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }
  return 'Đã xảy ra lỗi'
}
