'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { MapPin, Users, AlertCircle } from 'lucide-react'
import * as google from 'google.maps'

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
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<SupportRequest | null>(null)

  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key is not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable.')
      setLoading(false)
      return
    }

    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey: GOOGLE_MAPS_API_KEY,
          version: 'weekly',
        })

        await loader.load()

        if (mapRef.current) {
          // Center map on Vietnam
          const mapInstance = new google.maps.Map(mapRef.current, {
            zoom: 6,
            center: { lat: 15.8700, lng: 106.6833 },
            mapTypeId: 'roadmap',
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

          // Add sample data if no requests exist
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
                latitude: 19.1859,
                longitude: 105.7869,
                address: 'Tp. Hải Phòng',
                familyName: 'Gia Đình Lê Văn C',
                supportNeeds: ['medicine', 'clothes'],
                status: 'verified',
              },
            ]
          }

          setSupportRequests(requests)

          // Add markers to map
          markersRef.current.forEach(marker => marker.setMap(null))
          markersRef.current = []

          requests.forEach(request => {
            const iconColor = 
              request.status === 'verified' ? '#10b981' :
              request.status === 'pending' ? '#f59e0b' :
              '#ef4444'

            const marker = new google.maps.Marker({
              position: { lat: request.latitude, lng: request.longitude },
              map: mapInstance,
              title: request.familyName,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: iconColor,
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
            })

            marker.addListener('click', () => {
              setSelectedMarker(request)
              mapInstance.panTo({ lat: request.latitude, lng: request.longitude })
              mapInstance.setZoom(13)
            })

            markersRef.current.push(marker)
          })

          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing map:', error)
        setError('Failed to load map. Please check your Google Maps API key.')
        setLoading(false)
      }
    }

    initMap()
  }, [GOOGLE_MAPS_API_KEY])

  // Save support requests to localStorage when verification happens
  useEffect(() => {
    const handleStorageChange = () => {
      const storedRequests = localStorage.getItem('supportRequests')
      if (storedRequests) {
        setSupportRequests(JSON.parse(storedRequests))
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="container mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Bản Đồ Nhu Cầu Hỗ Trợ</h1>
            <p className="text-muted-foreground">
              Hiển thị toàn bộ gia đình cần hỗ trợ trên bản đồ Việt Nam
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6 flex gap-3">
              <AlertCircle className="text-destructive flex-shrink-0" size={20} />
              <div>
                <p className="font-semibold text-foreground">{error}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  To use Google Maps, set the environment variable: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Map Container */}
            <div className="lg:col-span-3">
              <div 
                ref={mapRef}
                className="w-full h-[500px] lg:h-[600px] rounded-lg border border-border bg-card"
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
                    <div className="w-4 h-4 rounded-full bg-success border-2 border-white" />
                    <span>Đã xác minh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-warning border-2 border-white" />
                    <span>Chờ xác minh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-destructive border-2 border-white" />
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
