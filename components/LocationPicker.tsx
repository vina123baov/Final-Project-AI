'use client'

import { useState, useEffect, useRef } from 'react'
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

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  // Initialize or update map when location changes
  useEffect(() => {
    if (!location || !mapContainerRef.current) return

    const initMap = async () => {
      const L = (await import('leaflet')).default

      // Fix leaflet default icon issue in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      // Red marker icon
      const redIcon = L.divIcon({
        html: `<div style="
          background-color: #ef4444;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      if (!mapInstanceRef.current) {
        // Create new map
        const map = L.map(mapContainerRef.current!, {
          center: [location.latitude, location.longitude],
          zoom: 15,
          zoomControl: true,
          attributionControl: false,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map)

        // Add red marker
        const marker = L.marker([location.latitude, location.longitude], { icon: redIcon }).addTo(map)
        marker.bindPopup(`<strong>Vị trí của bạn</strong><br/>${address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}`)

        // Add accuracy circle
        if (location.accuracy) {
          L.circle([location.latitude, location.longitude], {
            radius: location.accuracy,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.1,
            weight: 1,
          }).addTo(map)
        }

        mapInstanceRef.current = map
        markerRef.current = marker

        // Fix map rendering issue
        setTimeout(() => map.invalidateSize(), 100)
      } else {
        // Update existing map
        const map = mapInstanceRef.current
        map.setView([location.latitude, location.longitude], 15)

        if (markerRef.current) {
          markerRef.current.setLatLng([location.latitude, location.longitude])
          markerRef.current.setPopupContent(`<strong>Vị trí của bạn</strong><br/>${address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}`)
        }
      }
    }

    initMap()

    return () => {
      // Cleanup on unmount
    }
  }, [location, address])

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [])

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

        // Reverse geocoding
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
          console.log('Could not get address from coordinates')
        }

        setLocation(locationData)
        onLocationChange(locationData)
        setLoading(false)
      },
      (geoError) => {
        let errorMessage = 'Không thể lấy vị trí của bạn'

        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            errorMessage = 'Bạn đã từ chối chia sẻ vị trí. Vui lòng cấp quyền trong cài đặt.'
            break
          case geoError.POSITION_UNAVAILABLE:
            errorMessage = 'Thông tin vị trí không khả dụng'
            break
          case geoError.TIMEOUT:
            errorMessage = 'Hết thời gian chờ để lấy vị trí'
            break
        }

        setError(errorMessage)
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  return (
    <div className="space-y-3">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />

      <label className="text-sm font-semibold text-foreground block">
        Vị Trí Gia Đình {required && <span className="text-destructive">*</span>}
      </label>

      <div className="border border-border rounded-lg p-4 bg-card">
        {location ? (
          <div className="space-y-3">
            {/* Location info */}
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

            {/* Mini map with red marker */}
            <div
              ref={mapContainerRef}
              className="w-full h-52 rounded-lg border border-border overflow-hidden"
              style={{ zIndex: 0 }}
            />

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