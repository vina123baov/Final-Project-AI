'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { MapPin, AlertCircle } from 'lucide-react'

declare global {
  namespace google {
    namespace maps {
      class Map {
        constructor(element: HTMLElement, options: any)
      }
      class Marker {
        constructor(options: any)
        setMap(map: Map | null): void
        addListener(event: string, callback: () => void): void
      }
      class InfoWindow {
        constructor(options: any)
        open(map: Map, marker: Marker): void
        close(): void
      }
      interface LatLng {
        lat(): number
        lng(): number
      }
      interface LatLngBounds {
        contains(latLng: LatLng): boolean
      }
    }
  }
}

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
  const markersRef = useRef<any[]>([])
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<SupportRequest | null>(null)

  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Vietnam bounds to restrict map
  const VIETNAM_BOUNDS = {
    north: 23.393751,
    south: 8.562454,
    west: 102.144486,
    east: 109.639173,
  }

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key is not configured.')
      setLoading(false)
      return
    }

    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey: GOOGLE_MAPS_API_KEY,
          version: 'weekly',
        })

        const { Map, Marker, InfoWindow, LatLng } = await loader.load()

        if (mapRef.current && typeof google !== 'undefined') {
          // Center map on Vietnam
          const mapInstance = new google.maps.Map(mapRef.current, {
            zoom: 6,
            center: { lat: 15.8700, lng: 106.6833 },
            mapTypeId: 'roadmap',
            restriction: {
              latLngBounds: VIETNAM_BOUNDS,
              strictBounds: false,
            },
            styles: [
              {
                featureType: 'all',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#7c8494' }],
              },
              {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#e9e9e9' }, { lightness: 17 }],
              },
              {
                featureType: 'administrative',
                elementType: 'geometry.stroke',
                stylers: [{ color: '#c9c9c9' }],
              },
            ],
          })

          mapInstanceRef.current = mapInstance

          // Load support requests from localStorage
          const storedRequests = localStorage.getItem('supportRequests')
          let requests: SupportRequest[] = []

          if (storedRequests) {
            try {
              requests = JSON.parse(storedRequests)
            } catch (e) {
              console.error('Error parsing support requests:', e)
            }
          }

          // Add sample Vietnam data if no requests exist
          if (requests.length === 0) {
            requests = [
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
                latitude: 19.8245,
                longitude: 105.7930,
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
          }

          setSupportRequests(requests)

          // Add markers
          requests.forEach((request) => {
            const markerColor = {
              verified: '#22c55e',
              pending: '#eab308',
              rejected: '#ef4444',
            }[request.status] || '#3b82f6'

            const marker = new google.maps.Marker({
              position: { lat: request.latitude, lng: request.longitude },
              map: mapInstance,
              title: request.familyName,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: markerColor,
                fillOpacity: 0.8,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
            })

            marker.addListener('click', () => {
              setSelectedMarker(request)
              mapInstance.panTo({ lat: request.latitude, lng: request.longitude })
            })

            markersRef.current.push(marker)
          })

          setLoading(false)
        }
      } catch (err) {
        setError('Failed to load map. Please try again.')
        setLoading(false)
      }
    }

    initMap()
  }, [GOOGLE_MAPS_API_KEY])

  const stats = {
    total: supportRequests.length,
    verified: supportRequests.filter(r => r.status === 'verified').length,
    pending: supportRequests.filter(r => r.status === 'pending').length,
    rejected: supportRequests.filter(r => r.status === 'rejected').length,
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-secondary/30 rounded-lg border border-border">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-2 text-destructive" size={32} />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
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

      <div className={`${height} rounded-lg border border-border overflow-hidden`} ref={mapRef} />

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
