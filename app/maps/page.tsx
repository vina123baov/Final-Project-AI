'use client'

import { useEffect, useRef, useState } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { MapPin, Users, AlertCircle } from 'lucide-react'

interface SupportRequest {
  id: string
  latitude: number
  longitude: number
  address: string
  familyName: string
  supportNeeds: string[]
  status: 'verified' | 'pending' | 'rejected'
}

export default function MapsPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMarker, setSelectedMarker] = useState<SupportRequest | null>(null)

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

        // Sample data
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
            supportNeeds: ['medicine', 'clothes'],
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
              width: 28px;
              height: 28px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>`,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })

          const marker = L.marker([request.latitude, request.longitude], { icon })
            .addTo(map)

          marker.bindPopup(`
            <div style="font-size: 13px; min-width: 200px;">
              <strong style="font-size: 14px;">${request.familyName}</strong><br/>
              <span style="color: #666;">${request.address}</span><br/>
              <div style="margin-top: 6px;">
                ${request.supportNeeds.map(n => 
                  `<span style="display:inline-block;margin:2px;padding:2px 8px;background:${color}15;color:${color};border-radius:12px;font-size:11px;">${n}</span>`
                ).join('')}
              </div>
              <span style="
                display: inline-block;
                margin-top: 6px;
                padding: 2px 10px;
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

  return (
    <>
      <Header />
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="container mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Bản Đồ Nhu Cầu Hỗ Trợ</h1>
            <p className="text-muted-foreground">
              Hiển thị toàn bộ gia đình cần hỗ trợ trên bản đồ Việt Nam
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Map Container */}
            <div className="lg:col-span-3">
              <div
                ref={mapRef}
                className="w-full h-[500px] lg:h-[600px] rounded-lg border border-border bg-card"
                style={{ zIndex: 0 }}
              />
            </div>

            {/* Info Panel */}
            <div className="lg:col-span-1 space-y-4">
              {/* Statistics */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users size={20} />
                  Thống Kê
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tổng cộng:</span>
                    <span className="font-bold">{supportRequests.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đã xác minh:</span>
                    <span className="font-bold text-success">
                      {supportRequests.filter(r => r.status === 'verified').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chờ xác minh:</span>
                    <span className="font-bold text-warning">
                      {supportRequests.filter(r => r.status === 'pending').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bị từ chối:</span>
                    <span className="font-bold text-destructive">
                      {supportRequests.filter(r => r.status === 'rejected').length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-3">Chú Thích</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-success border-2 border-white shadow" />
                    <span>Đã xác minh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-warning border-2 border-white shadow" />
                    <span>Chờ xác minh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-destructive border-2 border-white shadow" />
                    <span>Bị từ chối</span>
                  </div>
                </div>
              </div>

              {/* Selected Marker Info */}
              {selectedMarker && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <MapPin size={20} />
                    Chi Tiết
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Gia đình</p>
                      <p className="font-medium text-foreground">{selectedMarker.familyName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Địa chỉ</p>
                      <p className="font-medium text-foreground">{selectedMarker.address}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nhu cầu</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedMarker.supportNeeds.map(need => (
                          <span
                            key={need}
                            className="px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                          >
                            {need}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Trạng thái</p>
                      <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                        selectedMarker.status === 'verified' ? 'bg-success/10 text-success' :
                        selectedMarker.status === 'pending' ? 'bg-warning/10 text-warning' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {selectedMarker.status === 'verified' ? 'Đã xác minh' :
                         selectedMarker.status === 'pending' ? 'Chờ xác minh' : 'Bị từ chối'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}