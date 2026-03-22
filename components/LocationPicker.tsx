'use client'

import { useState, useEffect } from 'react'
import { MapPin, AlertCircle, Loader } from 'lucide-react'

interface LocationData {
  latitude: number
  longitude: number
  address?: string
  accuracy?: number
}

interface LocationPickerProps {
  onLocationChange: (location: LocationData) => void
  required?: boolean
}

export default function LocationPicker({
  onLocationChange,
  required = true,
}: LocationPickerProps) {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [address, setAddress] = useState<string>('')

  const handleGetLocation = async () => {
    setLoading(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Trình duyệt của bạn không hỗ trợ geolocation')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        
        const locationData: LocationData = {
          latitude,
          longitude,
          accuracy,
        }

        // Try to get address from coordinates using reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          )
          const data = await response.json()
          locationData.address = data.address?.country === 'Vietnam' 
            ? `${data.address?.county || ''}, ${data.address?.state || ''}`
            : data.display_name
          setAddress(data.display_name)
        } catch (err) {
          console.log('[v0] Could not get address from coordinates')
        }

        setLocation(locationData)
        onLocationChange(locationData)
        setLoading(false)
      },
      (error) => {
        let errorMessage = 'Không thể lấy vị trí của bạn'
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Bạn đã từ chối chia sẻ vị trí. Vui lòng cấp quyền trong cài đặt.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Thông tin vị trí không khả dụng'
            break
          case error.TIMEOUT:
            errorMessage = 'Hết thời gian chờ để lấy vị trí'
            break
        }
        
        setError(errorMessage)
        setLoading(false)
      }
    )
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-foreground block">
        Vị Trí Gia Đình {required && <span className="text-destructive">*</span>}
      </label>
      
      <div className="border border-border rounded-lg p-4 bg-card">
        {location ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MapPin className="text-primary" size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Vị trí đã xác định
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </p>
                {location.accuracy && (
                  <p className="text-xs text-muted-foreground">
                    Độ chính xác: ±{Math.round(location.accuracy)} mét
                  </p>
                )}
              </div>
            </div>
            
            <button
              type="button"
              onClick={handleGetLocation}
              className="w-full px-4 py-2 text-sm text-primary hover:text-primary/80 font-medium transition"
            >
              Cập nhật vị trí
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nhấp để chia sẻ vị trí hiện tại của bạn
            </p>
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={loading}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Đang xác định vị trí...
                </>
              ) : (
                <>
                  <MapPin size={18} />
                  Xác định vị trí của tôi
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="text-destructive flex-shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
