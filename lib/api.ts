const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'


export interface VerifyResponse {
  success: boolean
  status: 'success' | 'failed' | 'pending' | 'error'
  result_type: string | null
  message: string
  need_retry: boolean
  predicted_class: string | null
  confidence: number | null
  blur_score: number | null
  is_blurry: boolean
  data: {
    id: number | null
    verification_code: string | null
    predicted_class: string | null
    confidence: number | null
    blur_score: number | null
    extracted_text: string | null
    household_name: string | null
    household_address: string | null
    household_id_number: string | null
    processing_time_ms: number | null
  }
}

export interface HistoryRecord {
  id: number
  status: string
  result_type: string | null
  confidence: number | null
  blur_score: number | null
  message: string | null
  need_retry: boolean
  verification_code: string | null
  created_at: string
  result_message: string
  predicted_class: string | null
  original_filename: string | null
  processing_time_ms: number | null
  household_name: string | null
  household_address: string | null
}

export interface AdminDashboard {
  dashboard: {
    total_active_users: number
    total_admins: number
    total_requests: number
    total_success: number
    total_failed: number
    total_pending: number
    avg_confidence: number
    avg_blur_score: number
    avg_processing_time_ms: number
    success_rate_percent: number
  }
  error_distribution: Array<{ result_type: string; count: number }>
}

export interface AdminRequest {
  id: number
  user_id: string
  status: string
  result_type: string | null
  confidence: number | null
  blur_score: number | null
  predicted_class: string | null
  message: string | null
  need_retry: boolean
  verification_code: string | null
  original_filename: string | null
  created_at: string
  extracted_text: string | null
  household_name: string | null
  household_address: string | null
  household_id_number: string | null
  processing_time_ms: number | null
  reviewed_by: string | null
  admin_notes: string | null
  stamp_detected: boolean
  stamp_score: number
  forgery_score: number
  province: string | null
  ocr_confidence: number | null
  user_latitude: number | null
  user_longitude: number | null
  user_location_address: string | null
  verified_at: string | null
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
  is_active: boolean
  created_at: string
  last_sign_in_at: string | null
  verification_count: number
}

export interface AuthTokens {
  access: string
  refresh: string
}

let accessToken: string | null = null
let refreshToken: string | null = null

export function setTokens(tokens: AuthTokens) {
  accessToken = tokens.access
  refreshToken = tokens.refresh
  if (typeof window !== 'undefined') {
    localStorage.setItem('jwt_access', tokens.access)
    localStorage.setItem('jwt_refresh', tokens.refresh)
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('jwt_access')
  }
  return accessToken
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken
  if (typeof window !== 'undefined') {
    refreshToken = localStorage.getItem('jwt_refresh')
  }
  return refreshToken
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem('jwt_access')
    localStorage.removeItem('jwt_refresh')
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const token = getAccessToken()

  const headers: Record<string, string> = {}

  // Dinh kem JWT token neu co (Section 2.1.2: JWT Authentication)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Giu nguyen Content-Type tu options (khong set cho FormData)
  if (options?.headers) {
    Object.assign(headers, options.headers)
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  // Token het han -> thu refresh
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`
      const retryRes = await fetch(url, { ...options, headers })
      if (!retryRes.ok) {
        const errorBody = await retryRes.text()
        throw new Error(`API ${retryRes.status}: ${errorBody}`)
      }
      return retryRes.json()
    } else {
      clearTokens()
      throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
    }
  }

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`API ${res.status}: ${errorBody}`)
  }

  return res.json()
}


export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || 'Email hoặc mật khẩu không đúng')
  }
  const tokens: AuthTokens = await res.json()
  setTokens(tokens)
  return tokens
}

export async function register(data: {
  full_name: string; email: string; phone: string; password: string
}): Promise<{ message: string; user_id: string }> {
  const res = await fetch(`${API_BASE}/api/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || 'Lỗi đăng ký')
  }
  return res.json()
}

export async function refreshAccessToken(): Promise<boolean> {
  try {
    const refresh = getRefreshToken()
    if (!refresh) return false
    const res = await fetch(`${API_BASE}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) return false
    const data = await res.json()
    accessToken = data.access
    if (typeof window !== 'undefined') localStorage.setItem('jwt_access', data.access)
    return true
  } catch { return false }
}

export async function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/auth/me/')
}

export async function logout() {
  clearTokens()
}

export async function verifyImage(
  imageFile: File,
  userId?: string,
  location?: { latitude: number; longitude: number; address?: string }
): Promise<VerifyResponse> {
  const formData = new FormData()
  formData.append('image', imageFile)
  if (userId) formData.append('user_id', userId)
  if (location) {
    formData.append('latitude', String(location.latitude))
    formData.append('longitude', String(location.longitude))
    if (location.address) formData.append('address', location.address)
  }
  return apiFetch<VerifyResponse>('/api/verify/', { method: 'POST', body: formData })
}


export async function getResult(requestId: number): Promise<AdminRequest> {
  return apiFetch<AdminRequest>(`/api/result/${requestId}/`)
}


export async function getHistory(
  userId: string, limit: number = 50
): Promise<{ data: HistoryRecord[]; count: number }> {
  return apiFetch(`/api/history/?user_id=${encodeURIComponent(userId)}&limit=${limit}`)
}


export async function getAdminDashboard(): Promise<AdminDashboard> {
  return apiFetch<AdminDashboard>('/api/admin/dashboard/')
}

export async function getAdminRequests(
  status?: string, limit: number = 100
): Promise<{ data: AdminRequest[]; count: number }> {
  let url = `/api/admin/requests/?limit=${limit}`
  if (status) url += `&status=${encodeURIComponent(status)}`
  return apiFetch(url)
}

export async function adminReview(
  requestId: number, adminId: string, notes: string
): Promise<{ data: AdminRequest }> {
  return apiFetch('/api/admin/review/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, admin_id: adminId, notes }),
  })
}

export async function getAdminUsers(): Promise<{ data: UserProfile[]; count: number }> {
  return apiFetch('/api/admin/users/')
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<{ data: UserProfile }> {
  return apiFetch('/api/admin/users/toggle/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, is_active: isActive }),
  })
}

export async function healthCheck() {
  return apiFetch<any>('/api/health/')
}