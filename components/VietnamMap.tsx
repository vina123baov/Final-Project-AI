'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, AlertCircle } from 'lucide-react'

interface SupportRequest {
  id: string
  latitude: number
  longitude: number
  address: string
  familyName: string
  supportNeeds: string[]
  status: 'verified' | 'pending' | 'rejected'
}

interface VietnamMapProps {
  height?: string
  showStats?: boolean
}

export default function VietnamMap({ height = 'h-96', showStats = true }: VietnamMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
  const [selectedMarker, setSelectedMarker] = useState<SupportRequest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default

        // Fix leaflet default icon issue in Next.js
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        // Create map centered on Vietnam
        const map = L.map(mapRef.current!, {
          center: [15.87, 106.68],
          zoom: 6,
          minZoom: 5,
          maxZoom: 18,
        })

        // Add OpenStreetMap tile layer (FREE)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map)

        mapInstanceRef.current = map

        // Sample data for Vietnam
        const requests: SupportRequest[] = [
          {
            id: '1',
            latitude: 21.0285,
            longitude: 105.8542,
            address: 'Quận Hoàn Kiếm, Hà Nội',
            familyName: 'Gia Đình Nguyễn Văn A',
            supportNeeds: ['rice', 'water'],
            status: 'verified',
          },
          {
            id: '2',
            latitude: 10.7769,
            longitude: 106.7009,
            address: 'Quận 1, TP. Hồ Chí Minh',
            familyName: 'Gia Đình Trần Thị B',
            supportNeeds: ['bread', 'food'],
            status: 'pending',
          },
          {
            id: '3',
            latitude: 20.8449,
            longitude: 106.6881,
            address: 'Thành phố Hải Phòng',
            familyName: 'Gia Đình Lê Văn C',
            supportNeeds: ['rice', 'medicine', 'water'],
            status: 'verified',
          },
          {
            id: '4',
            latitude: 16.0544,
            longitude: 108.2022,
            address: 'Thành phố Đà Nẵng',
            familyName: 'Gia Đình Phạm Thị D',
            supportNeeds: ['food', 'clothes'],
            status: 'verified',
          },
          {
            id: '5',
            latitude: 12.2381,
            longitude: 109.1967,
            address: 'Thành phố Nha Trang',
            familyName: 'Gia Đình Hoàng Văn E',
            supportNeeds: ['rice', 'water', 'school_supplies'],
            status: 'pending',
          },
        ]

        setSupportRequests(requests)

        // Add markers
        requests.forEach((request) => {
          const color =
            request.status === 'verified' ? '#22c55e' :
            request.status === 'pending' ? '#eab308' :
            '#ef4444'

          const icon = L.divIcon({
            html: `<div style="
              background-color: ${color};
              width: 24px;
              height: 24px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            "></div>`,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })

          const marker = L.marker([request.latitude, request.longitude], { icon })
            .addTo(map)

          marker.bindPopup(`
            <div style="font-size: 13px; min-width: 180px;">
              <strong>${request.familyName}</strong><br/>
              <span style="color: #666;">${request.address}</span><br/>
              <span style="
                display: inline-block;
                margin-top: 4px;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                background: ${color}20;
                color: ${color};
              ">
                ${request.status === 'verified' ? '✓ Đã xác minh' :
                  request.status === 'pending' ? '⏳ Chờ xác minh' : '✕ Bị từ chối'}
              </span>
            </div>
          `)

          marker.on('click', () => {
            setSelectedMarker(request)
          })
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
  }, [])

  const stats = {
    total: supportRequests.length,
    verified: supportRequests.filter(r => r.status === 'verified').length,
    pending: supportRequests.filter(r => r.status === 'pending').length,
    rejected: supportRequests.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-4">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />

      {showStats && (
        <div className="grid grid-cols-4 gap-3">
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
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
            <p className="text-sm text-destructive">Bị từ chối</p>
            <p className="text-lg font-bold text-destructive">{stats.rejected}</p>
          </div>
        </div>
      )}

      <div
        ref={mapRef}
        className={`${height} rounded-lg border border-border overflow-hidden`}
        style={{ minHeight: '400px', zIndex: 0 }}
      />

      {selectedMarker && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <MapPin className="text-primary" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{selectedMarker.familyName}</h3>
              <p className="text-sm text-muted-foreground mb-2">{selectedMarker.address}</p>
              <div className="flex flex-wrap gap-2">
                {selectedMarker.supportNeeds.map((need) => (
                  <span key={need} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                    {need}
                  </span>
                ))}
              </div>
              <p className={`text-xs font-medium mt-2 ${
                selectedMarker.status === 'verified' ? 'text-success' :
                selectedMarker.status === 'pending' ? 'text-warning' :
                'text-destructive'
              }`}>
                Trạng thái: {
                  selectedMarker.status === 'verified' ? 'Đã xác minh' :
                  selectedMarker.status === 'pending' ? 'Chờ xác minh' :
                  'Bị từ chối'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}