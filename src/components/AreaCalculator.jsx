import { useMemo } from 'react'
import { calculateArea, calculatePerimeter, calculateSegmentDistances, formatArea, formatDistance } from '../utils/calculations'

export default function AreaCalculator({ points, coordinateSystem }) {
  const area = useMemo(() => calculateArea(points), [points])
  const perimeter = useMemo(() => calculatePerimeter(points), [points])
  const segments = useMemo(() => calculateSegmentDistances(points), [points])

  if (points.length < 2) {
    return (
      <div className="panel area-calculator">
        <h3>Measurements</h3>
        <p style={{ color: '#666', fontSize: '0.85rem' }}>
          Add at least 3 points to calculate area.
        </p>
      </div>
    )
  }

  return (
    <div className="panel area-calculator">
      <h3>Measurements</h3>

      <div className="stats">
        <div className="stat-item">
          <div className="label">Area</div>
          <div className="value">{formatArea(area)}</div>
        </div>
        <div className="stat-item">
          <div className="label">Hectares</div>
          <div className="value">{area.hectares.toFixed(3)}</div>
        </div>
        <div className="stat-item">
          <div className="label">Acres</div>
          <div className="value">{area.acres.toFixed(3)}</div>
        </div>
        <div className="stat-item">
          <div className="label">Perimeter</div>
          <div className="value">{formatDistance(perimeter)}</div>
        </div>
      </div>

      {segments.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Segment Distances</h4>
          <div style={{ fontSize: '0.8rem', maxHeight: '100px', overflowY: 'auto' }}>
            {segments.map((seg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                <span>P{seg.from} → P{seg.to}</span>
                <span style={{ fontFamily: 'monospace' }}>{formatDistance(seg.distance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
