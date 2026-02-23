import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import { ZAMBIA_BOUNDS, isInZambia, wgs84ToUtm } from '../utils/coordinates'
import { calculateArea, calculatePerimeter, formatArea, formatDistance } from '../utils/calculations'

// Fix for default marker icons in webpack/vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
})

// Zambia bounds for map restriction
const zambiaBounds = L.latLngBounds(
  [ZAMBIA_BOUNDS.minLat, ZAMBIA_BOUNDS.minLng], // Southwest
  [ZAMBIA_BOUNDS.maxLat, ZAMBIA_BOUNDS.maxLng]  // Northeast
)

export default function MapView({ points, onAddPoint, onUpdatePoint, coordinateSystem, utmZone = 35 }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const polygonRef = useRef(null)

  // Store callback in ref to avoid stale closure
  const onAddPointRef = useRef(onAddPoint)
  onAddPointRef.current = onAddPoint

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return

    // Center on Lusaka, Zambia
    const map = L.map(mapRef.current, {
      center: [-15.3875, 28.3228],
      zoom: 6,
      minZoom: 5,
      maxZoom: 18,
      maxBounds: zambiaBounds.pad(0.1), // Add 10% padding
      maxBoundsViscosity: 1.0 // Prevent dragging outside
    })

    // Base layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19
    })

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19
    })

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 17
    })

    // Add default layer
    osmLayer.addTo(map)

    // Layer control
    const baseLayers = {
      'Street Map': osmLayer,
      'Satellite': satelliteLayer,
      'Topographic': topoLayer
    }

    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map)

    // Add Zambia boundary outline
    L.rectangle(zambiaBounds, {
      color: '#D97757',
      weight: 2,
      fill: false,
      dashArray: '5, 5'
    }).addTo(map)

    // Add click handler to add points (only within Zambia)
    map.on('click', (e) => {
      const { lat, lng } = e.latlng

      if (!isInZambia(lat, lng)) {
        alert('Please click within Zambia boundaries')
        return
      }

      onAddPointRef.current({
        lat: lat,
        lng: lng
      })
    })

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Update markers and polygon when points change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Clear existing polygon
    if (polygonRef.current) {
      polygonRef.current.remove()
      polygonRef.current = null
    }

    if (points.length === 0) return

    // Filter valid points (within Zambia)
    const validPoints = points.filter(p => isInZambia(p.lat, p.lng))

    // Add markers for each point
    validPoints.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lng], {
        draggable: true,
        icon: L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background: #D97757;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${index + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(map)

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng()

        // Validate new position is within Zambia
        if (!isInZambia(newPos.lat, newPos.lng)) {
          // Reset to original position
          marker.setLatLng([point.lat, point.lng])
          alert('Point must stay within Zambia')
          return
        }

        onUpdatePoint(point.id, {
          lat: newPos.lat,
          lng: newPos.lng
        })
      })

      // Calculate UTM coordinates for popup
      const utm = wgs84ToUtm(point.lat, point.lng, utmZone)

      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 180px;">
          <strong style="font-size: 14px;">Point ${index + 1}</strong>
          <hr style="margin: 5px 0; border: none; border-top: 1px solid #ddd;">
          <div style="font-size: 12px;">
            <strong>WGS84:</strong><br>
            Lat: ${point.lat.toFixed(6)}<br>
            Lng: ${point.lng.toFixed(6)}
          </div>
          <div style="font-size: 12px; margin-top: 8px;">
            <strong>UTM Zone ${utmZone}S:</strong><br>
            E: ${utm.easting.toFixed(2)} m<br>
            N: ${utm.northing.toFixed(2)} m
          </div>
        </div>
      `)

      markersRef.current.push(marker)
    })

    // Draw polygon if we have 3+ points
    if (validPoints.length >= 3) {
      const latlngs = validPoints.map(p => [p.lat, p.lng])
      polygonRef.current = L.polygon(latlngs, {
        color: '#D97757',
        fillColor: '#E8A88A',
        fillOpacity: 0.3,
        weight: 2
      }).addTo(map)

      // Calculate area and perimeter for tooltip
      const area = calculateArea(validPoints)
      const perimeter = calculatePerimeter(validPoints)

      // Create tooltip content with all point coordinates
      const pointsList = validPoints.map((p, i) => {
        const utm = wgs84ToUtm(p.lat, p.lng, utmZone)
        return `<tr>
          <td style="padding: 2px 5px; font-weight: bold;">${i + 1}</td>
          <td style="padding: 2px 5px;">${utm.easting.toFixed(0)}</td>
          <td style="padding: 2px 5px;">${utm.northing.toFixed(0)}</td>
        </tr>`
      }).join('')

      const tooltipContent = `
        <div style="font-family: sans-serif; min-width: 200px;">
          <strong style="font-size: 13px; color: #D97757;">Survey Area</strong>
          <hr style="margin: 5px 0; border: none; border-top: 1px solid #ddd;">
          <div style="font-size: 12px; margin-bottom: 8px;">
            <strong>Area:</strong> ${formatArea(area)}<br>
            <strong>Perimeter:</strong> ${formatDistance(perimeter)}
          </div>
          <div style="font-size: 11px;">
            <strong>UTM Zone ${utmZone}S Coordinates:</strong>
            <table style="margin-top: 4px; border-collapse: collapse; width: 100%;">
              <tr style="background: #f5f5f5;">
                <th style="padding: 2px 5px; text-align: left;">Pt</th>
                <th style="padding: 2px 5px; text-align: left;">Easting</th>
                <th style="padding: 2px 5px; text-align: left;">Northing</th>
              </tr>
              ${pointsList}
            </table>
          </div>
        </div>
      `

      // Bind tooltip that shows on hover
      polygonRef.current.bindTooltip(tooltipContent, {
        sticky: true,
        direction: 'top',
        offset: [0, -10],
        className: 'survey-tooltip'
      })

      // Highlight on hover
      polygonRef.current.on('mouseover', function() {
        this.setStyle({
          fillOpacity: 0.5,
          weight: 3
        })
      })

      polygonRef.current.on('mouseout', function() {
        this.setStyle({
          fillOpacity: 0.3,
          weight: 2
        })
      })

    } else if (validPoints.length === 2) {
      // Draw line between 2 points
      const latlngs = validPoints.map(p => [p.lat, p.lng])
      polygonRef.current = L.polyline(latlngs, {
        color: '#D97757',
        weight: 2
      }).addTo(map)

      // Show distance tooltip for line
      const distance = calculatePerimeter(validPoints)
      const utm1 = wgs84ToUtm(validPoints[0].lat, validPoints[0].lng, utmZone)
      const utm2 = wgs84ToUtm(validPoints[1].lat, validPoints[1].lng, utmZone)

      const lineTooltip = `
        <div style="font-family: sans-serif;">
          <strong>Distance:</strong> ${formatDistance(distance)}<br>
          <strong>Point 1:</strong> E ${utm1.easting.toFixed(0)}, N ${utm1.northing.toFixed(0)}<br>
          <strong>Point 2:</strong> E ${utm2.easting.toFixed(0)}, N ${utm2.northing.toFixed(0)}
        </div>
      `

      polygonRef.current.bindTooltip(lineTooltip, {
        sticky: true,
        direction: 'top',
        className: 'survey-tooltip'
      })
    }

    // Fit bounds to show all points (within Zambia bounds)
    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(validPoints.map(p => [p.lat, p.lng]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    }
  }, [points, onUpdatePoint])

  return (
    <div className="map-container" ref={mapRef} style={{ height: '100%', minHeight: '400px' }} />
  )
}
