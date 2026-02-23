import { useState } from 'react'
import { formatCoordinate, parseCoordinateInput } from '../utils/coordinates'

export default function CoordinatePanel({
  points,
  coordinateSystem,
  utmZone = 35,
  onAddPoint,
  onUpdatePoint,
  onDeletePoint,
  onClearPoints
}) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')

  const handleAddManual = () => {
    try {
      const point = parseCoordinateInput(inputValue, coordinateSystem, utmZone)
      onAddPoint(point)
      setInputValue('')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddManual()
    }
  }

  return (
    <div className="panel coordinate-panel">
      <h3>Survey Points ({points.length})</h3>

      <div className="point-list">
        {points.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.85rem' }}>
            Click on the map to add points, or enter coordinates below.
          </p>
        ) : (
          points.map((point, index) => (
            <div key={point.id} className="point-item">
              <span className="point-num">{index + 1}</span>
              <span className="coords">
                {formatCoordinate(point, coordinateSystem, utmZone)}
              </span>
              <button
                className="delete-btn"
                onClick={() => onDeletePoint(point.id)}
                title="Delete point"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="manual-entry">
        <label style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
          {coordinateSystem === 'utm' ? `Enter: Easting, Northing (Zone ${utmZone}S)` : 'Enter: Latitude, Longitude'}
        </label>
        <div className="input-row">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={coordinateSystem === 'utm' ? '500000, 8300000' : '-15.3875, 28.3228'}
          />
        </div>
        {error && (
          <p style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{error}</p>
        )}
        <button onClick={handleAddManual}>Add Point</button>

        {points.length > 0 && (
          <button
            onClick={onClearPoints}
            style={{ marginTop: '0.5rem', background: '#dc2626' }}
          >
            Clear All Points
          </button>
        )}
      </div>
    </div>
  )
}
