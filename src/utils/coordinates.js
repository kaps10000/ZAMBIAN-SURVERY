import proj4 from 'proj4'

// Define UTM zone projections
// UTM zones are numbered 1-60, covering 6 degrees of longitude each
// Zone 1 starts at 180W, zone 31 covers 0-6E (includes UK), etc.

export function getUTMZone(lng) {
  return Math.floor((lng + 180) / 6) + 1
}

export function getUTMHemisphere(lat) {
  return lat >= 0 ? 'N' : 'S'
}

export function getUTMProjection(lng, lat) {
  const zone = getUTMZone(lng)
  const hemisphere = getUTMHemisphere(lat)

  // EPSG codes: 326XX for Northern hemisphere, 327XX for Southern
  const epsgCode = hemisphere === 'N' ? 32600 + zone : 32700 + zone

  // Define the projection string
  const utmProj = `+proj=utm +zone=${zone} +${hemisphere === 'S' ? 'south ' : ''}+datum=WGS84 +units=m +no_defs`

  return { zone, hemisphere, epsgCode, proj: utmProj }
}

// Convert WGS84 (lat/lng) to UTM (easting/northing)
// If zone is provided, use it; otherwise auto-detect
export function wgs84ToUtm(lat, lng, zoneOverride = null) {
  const zone = zoneOverride || getUTMZone(lng)
  const hemisphere = getUTMHemisphere(lat)

  const utmProj = `+proj=utm +zone=${zone} +${hemisphere === 'S' ? 'south ' : ''}+datum=WGS84 +units=m +no_defs`

  // proj4 expects [lng, lat] order
  const [easting, northing] = proj4(utmProj).forward([lng, lat])

  return {
    easting: Math.round(easting * 1000) / 1000,
    northing: Math.round(northing * 1000) / 1000,
    zone,
    hemisphere
  }
}

// Convert UTM to WGS84
export function utmToWgs84(easting, northing, zone, hemisphere = 'N') {
  const utmProj = `+proj=utm +zone=${zone} +${hemisphere === 'S' ? 'south ' : ''}+datum=WGS84 +units=m +no_defs`

  const [lng, lat] = proj4(utmProj).inverse([easting, northing])

  return {
    lat: Math.round(lat * 1000000) / 1000000,
    lng: Math.round(lng * 1000000) / 1000000
  }
}

// Zambia boundaries (approximate)
export const ZAMBIA_BOUNDS = {
  minLat: -18.5,
  maxLat: -8.0,
  minLng: 21.5,
  maxLng: 34.0
}

// Check if coordinates are within Zambia
export function isInZambia(lat, lng) {
  return lat >= ZAMBIA_BOUNDS.minLat && lat <= ZAMBIA_BOUNDS.maxLat &&
         lng >= ZAMBIA_BOUNDS.minLng && lng <= ZAMBIA_BOUNDS.maxLng
}

// Format coordinates for display
export function formatCoordinate(point, system, utmZone = 35) {
  // Validate coordinates are in valid range
  if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
    return `Invalid: ${point.lat}, ${point.lng}`
  }

  if (system === 'utm') {
    try {
      const utm = wgs84ToUtm(point.lat, point.lng, utmZone)
      return `${utm.easting.toFixed(2)}E, ${utm.northing.toFixed(2)}N (Zone ${utm.zone}${utm.hemisphere})`
    } catch (e) {
      return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`
    }
  }
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`
}

// Parse coordinate input (handles both formats)
export function parseCoordinateInput(input, system, utmZone = 35) {
  // Clean input - remove extra spaces
  const cleanInput = input.replace(/\s+/g, ' ').trim()

  // Try splitting by comma or space
  let parts = cleanInput.split(',').map(s => s.trim())

  // If no comma, try splitting by space
  if (parts.length === 1) {
    parts = cleanInput.split(' ').filter(s => s.length > 0)
  }

  if (parts.length !== 2) {
    throw new Error('Enter two numbers separated by comma')
  }

  const first = parseFloat(parts[0])
  const second = parseFloat(parts[1])

  if (isNaN(first) || isNaN(second)) {
    throw new Error('Invalid numbers')
  }

  if (system === 'utm') {
    // Use the provided UTM zone (Zambia uses zones 34, 35, 36 - Southern hemisphere)
    const { lat, lng } = utmToWgs84(first, second, utmZone, 'S')

    // Validate the converted point is in Zambia
    if (!isInZambia(lat, lng)) {
      throw new Error(`UTM coordinates are outside Zambia (Zone ${utmZone}S)`)
    }

    return { lat, lng }
  }

  // WGS84 mode - validate directly
  if (!isInZambia(first, second)) {
    throw new Error('Coordinates are outside Zambia')
  }

  return { lat: first, lng: second }
}

// Calculate distance between two points in meters
export function calculateDistance(point1, point2) {
  const R = 6371000 // Earth's radius in meters
  const lat1 = point1.lat * Math.PI / 180
  const lat2 = point2.lat * Math.PI / 180
  const deltaLat = (point2.lat - point1.lat) * Math.PI / 180
  const deltaLng = (point2.lng - point1.lng) * Math.PI / 180

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
