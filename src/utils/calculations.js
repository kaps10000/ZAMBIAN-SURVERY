import * as turf from '@turf/turf'

// Calculate the area of a polygon defined by points
export function calculateArea(points) {
  if (points.length < 3) {
    return { sqMeters: 0, hectares: 0, acres: 0 }
  }

  // Create a GeoJSON polygon from points
  const coordinates = points.map(p => [p.lng, p.lat])
  // Close the polygon
  coordinates.push(coordinates[0])

  const polygon = turf.polygon([coordinates])
  const areaSqMeters = turf.area(polygon)

  return {
    sqMeters: Math.round(areaSqMeters * 100) / 100,
    hectares: Math.round(areaSqMeters / 10000 * 1000) / 1000,
    acres: Math.round(areaSqMeters / 4046.86 * 1000) / 1000
  }
}

// Calculate the perimeter of a polygon
export function calculatePerimeter(points) {
  if (points.length < 2) {
    return 0
  }

  const coordinates = points.map(p => [p.lng, p.lat])
  coordinates.push(coordinates[0]) // Close the polygon

  const line = turf.lineString(coordinates)
  const lengthMeters = turf.length(line, { units: 'meters' })

  return Math.round(lengthMeters * 100) / 100
}

// Calculate distance between consecutive points
export function calculateSegmentDistances(points) {
  if (points.length < 2) {
    return []
  }

  const distances = []
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % points.length]

    const from = turf.point([p1.lng, p1.lat])
    const to = turf.point([p2.lng, p2.lat])
    const distance = turf.distance(from, to, { units: 'meters' })

    distances.push({
      from: i + 1,
      to: ((i + 1) % points.length) + 1,
      distance: Math.round(distance * 100) / 100
    })
  }

  return distances
}

// Calculate centroid of polygon
export function calculateCentroid(points) {
  if (points.length < 3) {
    return null
  }

  const coordinates = points.map(p => [p.lng, p.lat])
  coordinates.push(coordinates[0])

  const polygon = turf.polygon([coordinates])
  const centroid = turf.centroid(polygon)

  return {
    lat: centroid.geometry.coordinates[1],
    lng: centroid.geometry.coordinates[0]
  }
}

// Calculate bounding box
export function calculateBoundingBox(points) {
  if (points.length === 0) {
    return null
  }

  const features = turf.featureCollection(
    points.map(p => turf.point([p.lng, p.lat]))
  )
  const bbox = turf.bbox(features)

  return {
    minLng: bbox[0],
    minLat: bbox[1],
    maxLng: bbox[2],
    maxLat: bbox[3]
  }
}

// Format area for display
export function formatArea(area) {
  if (area.sqMeters < 10000) {
    return `${area.sqMeters.toLocaleString()} m²`
  }
  return `${area.hectares.toLocaleString()} ha`
}

// Format distance for display
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${meters.toFixed(2)} m`
  }
  return `${(meters / 1000).toFixed(3)} km`
}
