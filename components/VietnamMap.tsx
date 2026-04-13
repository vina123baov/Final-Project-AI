'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface MapLocation {
  id: string
  latitude: number
  longitude: number
  address: string
  familyName: string
  status: 'verified' | 'pending' | 'rejected'
  date?: string
}

interface VietnamMapProps {
  height?: string
  showStats?: boolean
}

// Data mau khi API chua co data
const SAMPLE_DATA: MapLocation[] = [
  { id: 's1', latitude: 21.0285, longitude: 105.8542, address: 'Quận Hoàn Kiếm, Hà Nội', familyName: 'Gia Đình Nguyễn Văn A', status: 'verified' },
  { id: 's2', latitude: 10.7769, longitude: 106.7009, address: 'Quận 1, TP. Hồ Chí Minh', familyName: 'Gia Đình Trần Thị B', status: 'pending' },
  { id: 's3', latitude: 20.8449, longitude: 106.6881, address: 'Thành phố Hải Phòng', familyName: 'Gia Đình Lê Văn C', status: 'verified' },
  { id: 's4', latitude: 16.0544, longitude: 108.2022, address: 'Thành phố Đà Nẵng', familyName: 'Gia Đình Phạm Thị D', status: 'verified' },
  { id: 's5', latitude: 12.2381, longitude: 109.1967, address: 'Thành phố Nha Trang', familyName: 'Gia Đình Hoàng Văn E', status: 'pending' },
]

export default function VietnamMap({ height = 'h-96', showStats = true }: VietnamMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [locations, setLocations] = useState<MapLocation[]>([])
  const [selectedMarker, setSelectedMarker] = useState<MapLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLiveData, setIsLiveData] = useState(false)

  // Fetch vi tri thuc tu backend, fallback sang data mau
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/verified-locations/`)
        if (res.ok) {
          const data = await res.json()
          const apiLocations: MapLocation[] = (data.data || [])
            .filter((loc: any) => loc.user_latitude && loc.user_longitude)
            .map((loc: any) => ({
              id: String(loc.id),
              latitude: loc.user_latitude,
              longitude: loc.user_longitude,
              address: loc.user_location_address || loc.household_address || '',
              familyName: loc.household_name || 'Gia đình cần hỗ trợ',
              status: 'verified' as const,
              date: loc.created_at,
            }))

          if (apiLocations.length > 0) {
            setLocations(apiLocations)
            setIsLiveData(true)
          } else {
            setLocations(SAMPLE_DATA)
            setIsLiveData(false)
          }
        } else {
          setLocations(SAMPLE_DATA)
          setIsLiveData(false)
        }
      } catch {
        setLocations(SAMPLE_DATA)
        setIsLiveData(false)
      }
    }
    fetchLocations()
  }, [])

  // Tao map khi locations thay doi
  useEffect(() => {
    if (!mapRef.current || locations.length === 0) return

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default

        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        // Xoa map cu neu co
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove()
          mapInstanceRef.current = null
        }

        const map = L.map(mapRef.current!, {
          center: [15.87, 106.68],
          zoom: 6,
          minZoom: 5,
          maxZoom: 18,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map)

        mapInstanceRef.current = map

        // Them marker cho moi vi tri
        locations.forEach((loc) => {
          const color =
            loc.status === 'verified' ? '#ef4444' :
            loc.status === 'pending' ? '#eab308' :
            '#6b7280'

          const icon = L.divIcon({
            html: `<div style="
              background-color: ${color};
              width: 18px;
              height: 18px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px ${color}99;
              animation: mapPulse 2s infinite;
            "></div>`,
            className: '',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          })

          const marker = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map)

          const dateStr = loc.date ? new Date(loc.date).toLocaleDateString('vi-VN') : ''
          const statusLabel =
            loc.status === 'verified' ? '✓ Đã xác minh' :
            loc.status === 'pending' ? '⏳ Chờ xác minh' : '✕ Bị từ chối'
          const statusBg =
            loc.status === 'verified' ? '#dcfce7' :
            loc.status === 'pending' ? '#fef9c3' : '#fee2e2'
          const statusColor =
            loc.status === 'verified' ? '#22c55e' :
            loc.status === 'pending' ? '#ca8a04' : '#ef4444'

          marker.bindPopup(`
            <div style="font-size: 13px; min-width: 180px;">
              <strong style="color: #ef4444;">${loc.familyName}</strong><br/>
              <span style="color: #666;">${loc.address || 'Chưa có địa chỉ'}</span><br/>
              ${dateStr ? `<span style="color: #999; font-size: 11px;">Xác minh: ${dateStr}</span><br/>` : ''}
              <span style="
                display: inline-block;
                margin-top: 4px;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                background: ${statusBg};
                color: ${statusColor};
              ">${statusLabel}</span>
            </div>
          `)

          marker.on('click', () => setSelectedMarker(loc))
        })

        setLoading(false)
      } catch (err) {
        console.error('Map init error:', err)
        setLoading(false)
      }
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [locations])

  const stats = {
    total: locations.length,
    verified: locations.filter(r => r.status === 'verified').length,
    pending: locations.filter(r => r.status === 'pending').length,
    rejected: locations.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-4">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes mapPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}} />

      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Tổng cộng</p>
            <p className="text-lg font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
            <p className="text-sm text-success">Đã xác minh</p>
            <p className="text-lg font-bold text-success">{stats.verified}</p>
          </div>
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
            <p className="text-sm text-warning">Chờ xác minh</p>
            <p className="text-lg font-bold text-warning">{stats.pending}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-foreground font-medium">
              {isLiveData ? 'Dữ liệu thật' : 'Dữ liệu mẫu'}
            </span>
          </div>
        </div>
      )}

      <div
        ref={mapRef}
        className={`${height} rounded-lg border border-border overflow-hidden`}
        style={{ minHeight: '400px', zIndex: 0 }}
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader size={16} className="animate-spin" />
          <span className="text-sm">Đang tải bản đồ...</span>
        </div>
      )}

      {selectedMarker && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-destructive/10 rounded-lg flex-shrink-0">
              <MapPin className="text-destructive" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{selectedMarker.familyName}</h3>
              <p className="text-sm text-muted-foreground mb-2">{selectedMarker.address || 'Chưa có địa chỉ'}</p>
              {selectedMarker.date && (
                <p className="text-xs text-muted-foreground">Xác minh: {new Date(selectedMarker.date).toLocaleDateString('vi-VN')}</p>
              )}
              <p className={`text-xs font-medium mt-1 ${
                selectedMarker.status === 'verified' ? 'text-success' :
                selectedMarker.status === 'pending' ? 'text-warning' : 'text-destructive'
              }`}>
                {selectedMarker.status === 'verified' ? '✓ Đã xác minh' :
                 selectedMarker.status === 'pending' ? '⏳ Chờ xác minh' : '✕ Bị từ chối'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isLiveData && !loading && (
        <p className="text-xs text-center text-muted-foreground">
          Đang hiển thị dữ liệu mẫu. Khi có người xác minh thành công, chấm đỏ thật sẽ xuất hiện.
        </p>
      )}
    </div>
  )
}