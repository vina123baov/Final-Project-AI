'use client'

import { useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'

interface FamilyLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string
  supportNeeds: string[]
  status: 'verified' | 'pending' | 'rejected'
}

interface AdminMapProps {
  families: FamilyLocation[]
  onFamilySelect?: (family: FamilyLocation) => void
}

export default function AdminMap({ families, onFamilySelect }: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize Leaflet map
    const loadLeaflet = async () => {
      const L = await import('leaflet')
      
      if (!mapRef.current && containerRef.current) {
        const map = L.map(containerRef.current).setView([21.0285, 105.8542], 11) // Hanoi center

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        // Add markers for each family
        families.forEach((family) => {
          const statusColors = {
            verified: '#10b981',
            pending: '#f59e0b',
            rejected: '#ef4444',
          }

          const markerColor = statusColors[family.status]

          const markerHtml = `
            <div style="
              background-color: ${markerColor};
              color: white;
              padding: 8px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            ">
              ${family.status === 'verified' ? '✓' : family.status === 'pending' ? '⏳' : '✕'} ${family.name}
            </div>
          `

          const customIcon = L.divIcon({
            html: markerHtml,
            className: 'custom-marker',
            iconSize: [200, 40],
            iconAnchor: [100, 40],
          })

          const marker = L.marker([family.latitude, family.longitude], {
            icon: customIcon,
          }).addTo(map)

          marker.bindPopup(`
            <div style="padding: 8px; font-size: 12px;">
              <strong>${family.name}</strong><br/>
              <small>${family.address}</small><br/>
              <small>Trạng thái: ${family.status === 'verified' ? 'Đã xác minh' : family.status === 'pending' ? 'Đang chờ' : 'Bị từ chối'}</small>
            </div>
          `)

          marker.on('click', () => {
            if (onFamilySelect) {
              onFamilySelect(family)
            }
          })
        })

        mapRef.current = map
      }
    }

    loadLeaflet().catch(err => console.log('[v0] Error loading Leaflet:', err))

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [families, onFamilySelect])

  if (families.length === 0) {
    return (
      <div className="w-full h-96 bg-secondary rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="mx-auto text-muted-foreground mb-2" size={32} />
          <p className="text-muted-foreground">Không có dữ liệu vị trí để hiển thị</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-foreground">Đã xác minh</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-foreground">Đang chờ</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-foreground">Bị từ chối</span>
        </div>
      </div>
      
      <div
        ref={containerRef}
        className="w-full h-96 rounded-lg border border-border overflow-hidden"
        style={{ minHeight: '400px' }}
      />
    </div>
  )
}
