import { jsPDF } from 'jspdf'
import { wgs84ToUtm } from './coordinates'
import { calculateArea } from './calculations'

// Calculate bearing between two points
function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const lat1Rad = lat1 * Math.PI / 180
  const lat2Rad = lat2 * Math.PI / 180

  const y = Math.sin(dLng) * Math.cos(lat2Rad)
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)

  let bearing = Math.atan2(y, x) * 180 / Math.PI
  bearing = (bearing + 360) % 360

  return Math.round(bearing)
}

// Calculate distance between two UTM points
function calculateUtmDistance(e1, n1, e2, n2) {
  const dx = e2 - e1
  const dy = n2 - n1
  return Math.sqrt(dx * dx + dy * dy)
}

// Generate point label (A, B, C, ...)
function getPointLabel(index) {
  if (index < 26) {
    return String.fromCharCode(65 + index)
  }
  const first = Math.floor(index / 26) - 1
  const second = index % 26
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second)
}

// Draw decorative north arrow (compass rose style)
function drawNorthArrow(doc, x, y, size = 18) {
  // Outer circle
  doc.setDrawColor(0)
  doc.setLineWidth(0.8)
  doc.circle(x, y, size, 'S')

  // Second outer circle
  doc.setLineWidth(0.3)
  doc.circle(x, y, size * 0.95, 'S')

  // Inner decorative circles
  doc.circle(x, y, size * 0.4, 'S')
  doc.circle(x, y, size * 0.2, 'S')

  // Main 8-point star
  doc.setLineWidth(0.4)

  // Cardinal directions (N-S, E-W) - longer points
  const cardLen = size * 0.9
  // North point (filled)
  doc.setFillColor(0, 0, 0)
  doc.triangle(x, y - cardLen, x - 3, y, x + 3, y, 'F')
  // South point (outline)
  doc.setFillColor(255, 255, 255)
  doc.triangle(x, y + cardLen, x - 3, y, x + 3, y, 'FD')
  // East point
  doc.triangle(x + cardLen, y, x, y - 3, x, y + 3, 'FD')
  // West point
  doc.triangle(x - cardLen, y, x, y - 3, x, y + 3, 'FD')

  // Intercardinal directions (NE, NW, SE, SW) - shorter points
  const interLen = size * 0.6
  const diagOffset = interLen * 0.707 // cos(45°)
  doc.setLineWidth(0.3)

  // Draw thin triangles for diagonals
  const thinWidth = 1.5
  // NE
  doc.line(x, y, x + diagOffset, y - diagOffset)
  // NW
  doc.line(x, y, x - diagOffset, y - diagOffset)
  // SE
  doc.line(x, y, x + diagOffset, y + diagOffset)
  // SW
  doc.line(x, y, x - diagOffset, y + diagOffset)

  // Tick marks around edge
  doc.setLineWidth(0.2)
  for (let i = 0; i < 32; i++) {
    const angle = (i * 360 / 32) * Math.PI / 180
    const innerR = i % 4 === 0 ? size * 0.85 : size * 0.9
    const outerR = size * 0.95
    const x1 = x + Math.sin(angle) * innerR
    const y1 = y - Math.cos(angle) * innerR
    const x2 = x + Math.sin(angle) * outerR
    const y2 = y - Math.cos(angle) * outerR
    doc.line(x1, y1, x2, y2)
  }

  // N-S-E-W labels
  doc.setFontSize(9)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(0)
  doc.text('N', x - 2.5, y - size - 3)
  doc.text('S', x - 2, y + size + 6)
  doc.text('E', x + size + 3, y + 2)
  doc.text('W', x - size - 8, y + 2)
}

// Draw the plot shape with area circle inside
function drawPlotShape(doc, points, utmZone, startX, startY, maxWidth, maxHeight, areaHa, segments) {
  if (points.length < 3) return

  // Convert to UTM and find bounds
  const utmPoints = points.map(p => wgs84ToUtm(p.lat, p.lng, utmZone))
  const eastings = utmPoints.map(p => p.easting)
  const northings = utmPoints.map(p => p.northing)

  const minE = Math.min(...eastings)
  const maxE = Math.max(...eastings)
  const minN = Math.min(...northings)
  const maxN = Math.max(...northings)

  const rangeE = maxE - minE || 1
  const rangeN = maxN - minN || 1

  // Calculate scale to fit
  const scaleE = maxWidth / rangeE
  const scaleN = maxHeight / rangeN
  const scale = Math.min(scaleE, scaleN) * 0.75

  // Center offset
  const offsetX = startX + (maxWidth - rangeE * scale) / 2
  const offsetY = startY + (maxHeight - rangeN * scale) / 2

  // Convert UTM to PDF coordinates
  const pdfPoints = utmPoints.map((p, i) => ({
    x: offsetX + (p.easting - minE) * scale,
    y: offsetY + maxHeight - (p.northing - minN) * scale,
    label: getPointLabel(i)
  }))

  // Draw polygon outline in red
  doc.setDrawColor(180, 0, 0)
  doc.setLineWidth(0.8)

  for (let i = 0; i < pdfPoints.length; i++) {
    const p1 = pdfPoints[i]
    const p2 = pdfPoints[(i + 1) % pdfPoints.length]
    doc.line(p1.x, p1.y, p2.x, p2.y)

    // Draw distance label along segment
    if (segments && segments[i]) {
      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2

      // Calculate angle for text rotation
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const segLen = Math.sqrt(dx * dx + dy * dy)

      // Only show distance if segment is long enough
      if (segLen > 15) {
        // Offset text perpendicular to line
        const perpX = -dy / segLen * 4
        const perpY = dx / segLen * 4

        doc.setFontSize(7)
        doc.setFont(undefined, 'normal')
        doc.setTextColor(0, 0, 0)
        doc.text(`${segments[i].distance}m`, midX + perpX - 6, midY + perpY)
      }
    }
  }

  // Draw point markers and labels
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(0, 0, 0)

  pdfPoints.forEach((p, i) => {
    // Red filled circle for point
    doc.setFillColor(180, 0, 0)
    doc.circle(p.x, p.y, 2, 'F')

    // Calculate label position (outside the polygon)
    const prevP = pdfPoints[(i - 1 + pdfPoints.length) % pdfPoints.length]
    const nextP = pdfPoints[(i + 1) % pdfPoints.length]

    // Vector from adjacent points to current point
    const avgDx = (p.x - prevP.x) + (p.x - nextP.x)
    const avgDy = (p.y - prevP.y) + (p.y - nextP.y)
    const len = Math.sqrt(avgDx * avgDx + avgDy * avgDy) || 1

    // Offset label outward
    const labelX = p.x + (avgDx / len) * 6
    const labelY = p.y + (avgDy / len) * 6

    doc.text(p.label, labelX - 2, labelY + 2)
  })

  // Calculate centroid for area circle
  const centroidX = pdfPoints.reduce((sum, p) => sum + p.x, 0) / pdfPoints.length
  const centroidY = pdfPoints.reduce((sum, p) => sum + p.y, 0) / pdfPoints.length

  // Draw area circle
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  const circleRadius = 16
  doc.circle(centroidX, centroidY, circleRadius, 'S')

  // Area text inside circle
  doc.setFontSize(8)
  doc.setFont(undefined, 'bold')
  doc.text('Approx.', centroidX - 7, centroidY - 2)
  doc.setFontSize(10)
  doc.text(`${areaHa.toFixed(2)}Ha`, centroidX - 9, centroidY + 5)
}

export function exportMinistryFormat(points, options = {}) {
  const {
    applicantName = '',
    district = '',
    chiefdom = '',
    surveyedBy = '',
    drawnBy = '',
    approvedBy = '',
    zipNo = 'Nil',
    refNo = '',
    utmZone = 35,
    sheetRef = '',
    section = 'LAND HUSBANDRY SECTION NDOLA',
    unit = 'MAPPING AND REMOTE SENSING UNIT NDOLA',
    department = 'Department Of Agriculture, Technical Services Branch',
    address = 'P.O. Box 70232, Ndola'
  } = options

  const doc = new jsPDF('landscape', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth() // 297mm
  const pageHeight = doc.internal.pageSize.getHeight() // 210mm

  doc.setTextColor(0, 0, 0)

  // Convert points to UTM
  const utmPoints = points.map((p, i) => {
    const utm = wgs84ToUtm(p.lat, p.lng, utmZone)
    return {
      ...p,
      label: getPointLabel(i),
      easting: utm.easting,
      northing: utm.northing
    }
  })

  // Calculate segment data
  const segments = utmPoints.map((p, i) => {
    const next = utmPoints[(i + 1) % utmPoints.length]
    const distance = calculateUtmDistance(p.easting, p.northing, next.easting, next.northing)
    const bearing = calculateBearing(p.lat, p.lng, next.lat, next.lng)
    return {
      id: p.label.toLowerCase() + next.label.toLowerCase(),
      distance: Math.round(distance),
      bearing: bearing
    }
  })

  // Calculate area
  const area = calculateArea(points)

  // ============================================
  // TOP LEFT: North Arrow
  // ============================================
  drawNorthArrow(doc, 30, 28, 15)

  // Scale text below compass
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.text('Scale 1:6,000', 15, 55)

  // ============================================
  // TOP MIDDLE: Coordinate Table
  // ============================================
  const tableStartX = 60
  const tableStartY = 12
  const colWidths = [18, 26, 26, 16, 20, 24]
  const rowHeight = 6

  // Limit rows to prevent overflow (max ~8 rows in main area)
  const maxVisibleRows = 8
  const showAllPoints = utmPoints.length <= maxVisibleRows

  // Table header
  doc.setFontSize(7)
  doc.setFont(undefined, 'bold')
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(0)

  const headers = ['Point Id', 'X', 'Y', 'ID', 'Dist.(m)', 'Direction']
  let xPos = tableStartX
  headers.forEach((header, i) => {
    doc.rect(xPos, tableStartY, colWidths[i], rowHeight, 'S')
    doc.text(header, xPos + 1, tableStartY + 4)
    xPos += colWidths[i]
  })

  // Table rows
  doc.setFont(undefined, 'normal')
  doc.setFontSize(6)
  const pointsToShow = showAllPoints ? utmPoints : utmPoints.slice(0, maxVisibleRows - 1)

  pointsToShow.forEach((point, i) => {
    const y = tableStartY + rowHeight * (i + 1)
    xPos = tableStartX

    const rowData = [
      point.label,
      Math.round(point.easting).toString(),
      Math.round(point.northing).toString(),
      segments[i].id,
      segments[i].distance.toString(),
      `${segments[i].bearing}°`
    ]

    rowData.forEach((data, j) => {
      doc.rect(xPos, y, colWidths[j], rowHeight, 'S')
      doc.text(data, xPos + 1, y + 4)
      xPos += colWidths[j]
    })
  })

  // If there are more points, add a "continued on page 2" note
  if (!showAllPoints) {
    const y = tableStartY + rowHeight * maxVisibleRows
    xPos = tableStartX
    doc.rect(xPos, y, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'S')
    doc.setFont(undefined, 'italic')
    doc.text(`...${utmPoints.length - maxVisibleRows + 1} more points (see page 2)`, xPos + 2, y + 4)
    doc.setFont(undefined, 'normal')
  }

  // ============================================
  // BELOW TABLE: Coordinate System Info
  // ============================================
  const actualRowsShown = showAllPoints ? utmPoints.length : maxVisibleRows
  const tableEndY = tableStartY + rowHeight * (actualRowsShown + 1) + 3

  doc.setFontSize(8)
  doc.setFont(undefined, 'normal')
  const coordInfo = [
    `Coordinate System: Arc 1950 UTM Zone ${utmZone}S`,
    'Projection: Transverse Mercator',
    'Datum: Arc 1950',
    'false easting: 500,000.0000',
    'false northing: 10,000,000.0000',
    'central meridian: 27.0000',
    'scale factor: 0.9996',
    'latitude of origin: 0.0000',
    'Units: Meter'
  ]
  coordInfo.forEach((line, i) => {
    doc.text(line, tableStartX, tableEndY + i * 4)
  })

  // ============================================
  // LEFT MIDDLE: Plot Diagram
  // ============================================
  const plotStartX = 15
  const plotStartY = 62
  const plotWidth = 90
  const plotHeight = 70

  drawPlotShape(doc, points, utmZone, plotStartX, plotStartY, plotWidth, plotHeight, area.hectares, segments)

  // ============================================
  // BOTTOM LEFT: Allocation Text & Signatures
  // ============================================
  const sigStartY = 145

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text('These are the proposed boundaries bordered red allocated to', 10, sigStartY)

  doc.setFont(undefined, 'bold')
  doc.setFontSize(11)
  doc.text(applicantName.toUpperCase() || '[APPLICANT NAME]', 10, sigStartY + 7)

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text('Signed;', 10, sigStartY + 16)

  // Signature lines
  const sigLineY = sigStartY + 25
  doc.text(`Senior Chieftainess ${chiefdom || '...............'} .................................................................`, 10, sigLineY)
  doc.text(`${district || '...............'} District Council Secretary......................................................`, 10, sigLineY + 10)
  doc.text('Principal Agricultural Officer (CBP)...................................................', 10, sigLineY + 20)

  // ============================================
  // RIGHT SIDE: Location Map
  // ============================================
  const mapX = 160
  const mapY = 10
  const mapWidth = 130
  const mapHeight = 95

  // Map title
  doc.setFontSize(9)
  doc.setFont(undefined, 'bold')
  doc.text(`LOCATION MAP, SHEET REF: ${sheetRef || '________'}, SCALE 1:50,000`, mapX, mapY)

  // Map border
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  doc.rect(mapX, mapY + 3, mapWidth, mapHeight, 'S')

  // Map background (light tan like topo)
  doc.setFillColor(252, 248, 240)
  doc.rect(mapX + 0.5, mapY + 3.5, mapWidth - 1, mapHeight - 1, 'F')

  // Grid lines (blue like topo grids)
  doc.setDrawColor(100, 140, 180)
  doc.setLineWidth(0.15)
  const gridCols = 6
  const gridRows = 5
  for (let i = 1; i < gridCols; i++) {
    doc.line(mapX + i * (mapWidth / gridCols), mapY + 3, mapX + i * (mapWidth / gridCols), mapY + 3 + mapHeight)
  }
  for (let i = 1; i < gridRows; i++) {
    doc.line(mapX, mapY + 3 + i * (mapHeight / gridRows), mapX + mapWidth, mapY + 3 + i * (mapHeight / gridRows))
  }

  // Calculate grid reference values based on survey points
  const minN = Math.min(...utmPoints.map(p => p.northing))
  const maxN = Math.max(...utmPoints.map(p => p.northing))
  const minE = Math.min(...utmPoints.map(p => p.easting))
  const maxE = Math.max(...utmPoints.map(p => p.easting))

  // Expand range for context (show wider area)
  const rangeN = (maxN - minN) || 1000
  const rangeE = (maxE - minE) || 1000
  const expandFactor = 5
  const mapMinN = minN - rangeN * expandFactor
  const mapMaxN = maxN + rangeN * expandFactor
  const mapMinE = minE - rangeE * expandFactor
  const mapMaxE = maxE + rangeE * expandFactor
  const mapRangeN = mapMaxN - mapMinN
  const mapRangeE = mapMaxE - mapMinE

  // Y-axis labels (Northing) - left side
  doc.setFontSize(5)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(0)
  for (let i = 0; i <= gridRows; i++) {
    const northing = Math.round((mapMaxN - (mapRangeN * i / gridRows)) / 1000)
    doc.text(northing.toString(), mapX - 12, mapY + 5 + i * (mapHeight / gridRows))
  }

  // X-axis labels (Easting) - bottom
  for (let i = 0; i <= gridCols; i++) {
    const easting = Math.round((mapMinE + (mapRangeE * i / gridCols)) / 1000)
    doc.text(easting.toString(), mapX + i * (mapWidth / gridCols) - 3, mapY + mapHeight + 8)
  }

  // Draw the plot location on the map (small red polygon)
  const plotMapPoints = utmPoints.map(p => ({
    x: mapX + ((p.easting - mapMinE) / mapRangeE) * mapWidth,
    y: mapY + 3 + mapHeight - ((p.northing - mapMinN) / mapRangeN) * mapHeight
  }))

  // Calculate centroid of plot on map
  const plotCentX = plotMapPoints.reduce((sum, p) => sum + p.x, 0) / plotMapPoints.length
  const plotCentY = plotMapPoints.reduce((sum, p) => sum + p.y, 0) / plotMapPoints.length

  // Draw plot location marker (red filled rectangle)
  doc.setFillColor(180, 0, 0)
  doc.rect(plotCentX - 3, plotCentY - 3, 6, 6, 'F')

  // Draw red outline around it
  doc.setDrawColor(180, 0, 0)
  doc.setLineWidth(0.5)
  doc.rect(plotCentX - 5, plotCentY - 5, 10, 10, 'S')

  // Label
  doc.setFontSize(6)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(180, 0, 0)
  doc.text('SITE', plotCentX - 4, plotCentY + 10)
  doc.setTextColor(0)

  // ============================================
  // BOTTOM RIGHT: Info Boxes (Ministry Format)
  // ============================================
  const boxX = mapX
  const boxY = mapY + mapHeight + 12
  const boxWidth = mapWidth
  const boxHeight = 6

  doc.setFontSize(7)
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)

  // Row 1: Main Title
  doc.rect(boxX, boxY, boxWidth, boxHeight, 'S')
  doc.setFont(undefined, 'bold')
  const title1 = `PROPOSED LAND DEMARCATION FOR ${(applicantName || '___________').toUpperCase()}`
  doc.text(title1, boxX + boxWidth / 2 - doc.getTextWidth(title1) / 2, boxY + 4)

  // Row 2: District info
  doc.rect(boxX, boxY + boxHeight, boxWidth, boxHeight, 'S')
  const title2 = `${(applicantName || '___________').toUpperCase()} - ${(district || '___________').toUpperCase()} DISTRICT`
  doc.text(title2, boxX + boxWidth / 2 - doc.getTextWidth(title2) / 2, boxY + boxHeight + 4)

  // Row 3: Section
  doc.rect(boxX, boxY + boxHeight * 2, boxWidth, boxHeight, 'S')
  doc.text(section.toUpperCase(), boxX + boxWidth / 2 - doc.getTextWidth(section.toUpperCase()) / 2, boxY + boxHeight * 2 + 4)

  // Rows 4-6: Left column (Surveyed/Zip/Approved) + Right column (empty)
  doc.setFont(undefined, 'normal')
  const leftColWidth = 55

  // Surveyed row
  doc.rect(boxX, boxY + boxHeight * 3, leftColWidth, boxHeight, 'S')
  doc.text(`Surveyed: ${surveyedBy || ''}`, boxX + 2, boxY + boxHeight * 3 + 4)
  doc.rect(boxX + leftColWidth, boxY + boxHeight * 3, boxWidth - leftColWidth, boxHeight, 'S')

  // Zip No row
  doc.rect(boxX, boxY + boxHeight * 4, leftColWidth, boxHeight, 'S')
  doc.text(`Zip No.: ${zipNo}`, boxX + 2, boxY + boxHeight * 4 + 4)
  doc.rect(boxX + leftColWidth, boxY + boxHeight * 4, boxWidth - leftColWidth, boxHeight, 'S')

  // Approved row (first section)
  doc.rect(boxX, boxY + boxHeight * 5, leftColWidth, boxHeight, 'S')
  doc.text(`Approved: ${approvedBy || ''}`, boxX + 2, boxY + boxHeight * 5 + 4)
  doc.rect(boxX + leftColWidth, boxY + boxHeight * 5, boxWidth - leftColWidth, boxHeight, 'S')

  // Row 7: Mapping Unit header
  doc.setFont(undefined, 'bold')
  doc.rect(boxX, boxY + boxHeight * 6, boxWidth, boxHeight, 'S')
  doc.text(unit.toUpperCase(), boxX + boxWidth / 2 - doc.getTextWidth(unit.toUpperCase()) / 2, boxY + boxHeight * 6 + 4)

  // Bottom section with two columns
  doc.setFont(undefined, 'normal')
  const bottomLeftWidth = 35
  const bottomRightStart = boxX + bottomLeftWidth
  const bottomRightWidth = boxWidth - bottomLeftWidth

  // Left cells: Drawn, Approved, Date, REF
  doc.rect(boxX, boxY + boxHeight * 7, bottomLeftWidth, boxHeight, 'S')
  doc.text(`Drawn: ${drawnBy || ''}`, boxX + 2, boxY + boxHeight * 7 + 4)

  doc.rect(boxX, boxY + boxHeight * 8, bottomLeftWidth, boxHeight, 'S')
  doc.text(`Approved:`, boxX + 2, boxY + boxHeight * 8 + 4)

  doc.rect(boxX, boxY + boxHeight * 9, bottomLeftWidth, boxHeight, 'S')
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, boxX + 2, boxY + boxHeight * 9 + 4)

  doc.rect(boxX, boxY + boxHeight * 10, bottomLeftWidth, boxHeight, 'S')
  doc.text(`REF: ${refNo || ''}`, boxX + 2, boxY + boxHeight * 10 + 4)

  // Right merged cell: Department info (spans 4 rows)
  doc.rect(bottomRightStart, boxY + boxHeight * 7, bottomRightWidth, boxHeight * 4, 'S')
  doc.setFont(undefined, 'bold')
  doc.setFontSize(8)
  doc.text(department, bottomRightStart + 5, boxY + boxHeight * 8 + 2)
  doc.setFontSize(7)
  doc.text(address, bottomRightStart + 15, boxY + boxHeight * 9 + 2)

  // ============================================
  // PAGE 2: Full coordinate table (if many points)
  // ============================================
  if (!showAllPoints) {
    doc.addPage()

    // Page 2 title
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text('COMPLETE COORDINATE TABLE', pageWidth / 2 - 35, 15)

    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.text(`${applicantName.toUpperCase() || 'Survey'} - ${district.toUpperCase() || ''} District`, pageWidth / 2 - 40, 22)

    // Full table
    const p2TableX = 20
    const p2TableY = 30
    const p2RowHeight = 7
    const p2ColWidths = [25, 35, 35, 25, 30, 35]

    // Header
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    let p2XPos = p2TableX
    headers.forEach((header, i) => {
      doc.rect(p2XPos, p2TableY, p2ColWidths[i], p2RowHeight, 'S')
      doc.text(header, p2XPos + 2, p2TableY + 5)
      p2XPos += p2ColWidths[i]
    })

    // All rows
    doc.setFont(undefined, 'normal')
    doc.setFontSize(8)
    utmPoints.forEach((point, i) => {
      const y = p2TableY + p2RowHeight * (i + 1)

      // Check if we need a new column (page can fit ~22 rows)
      if (y > pageHeight - 20) {
        // Would overflow - for now just truncate
        return
      }

      p2XPos = p2TableX

      const rowData = [
        point.label,
        Math.round(point.easting).toString(),
        Math.round(point.northing).toString(),
        segments[i].id,
        segments[i].distance.toString(),
        `${segments[i].bearing}°`
      ]

      rowData.forEach((data, j) => {
        doc.rect(p2XPos, y, p2ColWidths[j], p2RowHeight, 'S')
        doc.text(data, p2XPos + 2, y + 5)
        p2XPos += p2ColWidths[j]
      })
    })

    // Coordinate system info at bottom
    doc.setFontSize(8)
    const p2InfoY = pageHeight - 35
    doc.text(`Coordinate System: Arc 1950 UTM Zone ${utmZone}S`, p2TableX, p2InfoY)
    doc.text('Datum: Arc 1950 | Projection: Transverse Mercator | Units: Meter', p2TableX, p2InfoY + 5)
    doc.text(`Total Area: ${area.hectares.toFixed(3)} hectares (${area.squareMeters.toFixed(1)} m²)`, p2TableX, p2InfoY + 10)

    // Footer
    doc.setFontSize(7)
    doc.text('Page 2 of 2', pageWidth - 30, pageHeight - 10)
  }

  // Save the PDF
  doc.save(`${applicantName || 'survey'}-demarcation.pdf`)
}
