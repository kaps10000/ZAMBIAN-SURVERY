import { useState } from 'react'
import { exportMinistryFormat } from '../utils/pdfExport'

export default function ExportDialog({ points, utmZone, onClose }) {
  const [formData, setFormData] = useState({
    applicantName: '',
    district: '',
    chiefdom: '',
    surveyedBy: '',
    drawnBy: '',
    approvedBy: '',
    zipNo: 'Nil',
    refNo: '',
    sheetRef: '',
    section: 'LAND HUSBANDRY SECTION NDOLA',
    unit: 'MAPPING AND REMOTE SENSING UNIT NDOLA',
    department: 'Department Of Agriculture, Technical Services Branch',
    address: 'P.O. Box 70232, Ndola'
  })

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleExport = () => {
    exportMinistryFormat(points, {
      ...formData,
      utmZone,
      projectName: formData.applicantName || 'Survey'
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '85vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Export Ministry of Lands Format</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </div>

        <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Fill in the details for the official land demarcation document:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Applicant Info */}
          <div style={{ gridColumn: '1 / -1' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#D97757' }}>Applicant Information</h4>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Applicant Name *
            </label>
            <input
              type="text"
              value={formData.applicantName}
              onChange={(e) => handleChange('applicantName', e.target.value)}
              placeholder="e.g., CHILESHE RICHARD"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              District *
            </label>
            <input
              type="text"
              value={formData.district}
              onChange={(e) => handleChange('district', e.target.value)}
              placeholder="e.g., Masaiti"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Chiefdom/Chief
            </label>
            <input
              type="text"
              value={formData.chiefdom}
              onChange={(e) => handleChange('chiefdom', e.target.value)}
              placeholder="e.g., Mushili"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Topo Sheet Reference
            </label>
            <input
              type="text"
              value={formData.sheetRef}
              onChange={(e) => handleChange('sheetRef', e.target.value)}
              placeholder="e.g., 1328 B3"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          {/* Survey Info */}
          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#D97757' }}>Survey Information</h4>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Surveyed By
            </label>
            <input
              type="text"
              value={formData.surveyedBy}
              onChange={(e) => handleChange('surveyedBy', e.target.value)}
              placeholder="e.g., D. Nkhoma"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Zip No.
            </label>
            <input
              type="text"
              value={formData.zipNo}
              onChange={(e) => handleChange('zipNo', e.target.value)}
              placeholder="Nil"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Drawn By
            </label>
            <input
              type="text"
              value={formData.drawnBy}
              onChange={(e) => handleChange('drawnBy', e.target.value)}
              placeholder="e.g., E. Moomba(TechZIP/1/062)"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Approved By
            </label>
            <input
              type="text"
              value={formData.approvedBy}
              onChange={(e) => handleChange('approvedBy', e.target.value)}
              placeholder="e.g., V. Michelo"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Reference No.
            </label>
            <input
              type="text"
              value={formData.refNo}
              onChange={(e) => handleChange('refNo', e.target.value)}
              placeholder="e.g., CBP/6"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          {/* Department Info */}
          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#D97757' }}>Department Information</h4>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Section
            </label>
            <input
              type="text"
              value={formData.section}
              onChange={(e) => handleChange('section', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Unit
            </label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => handleChange('unit', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Department
            </label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => handleChange('department', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>

        {/* Preview info */}
        <div style={{
          background: '#f5f5f5',
          padding: '0.75rem',
          borderRadius: '4px',
          marginTop: '1rem',
          fontSize: '0.85rem'
        }}>
          <strong>Export will include:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
            <li>{points.length} survey points with coordinates</li>
            <li>UTM Zone {utmZone}S (Arc 1950)</li>
            <li>Segment distances and bearings</li>
            <li>Plot diagram with labeled points</li>
            <li>Area calculation</li>
            <li>Official signature blocks</li>
          </ul>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              background: 'white'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={points.length < 3}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: points.length >= 3 ? '#D97757' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: points.length >= 3 ? 'pointer' : 'not-allowed'
            }}
          >
            Export PDF
          </button>
        </div>

        {points.length < 3 && (
          <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
            Add at least 3 points to export
          </p>
        )}
      </div>
    </div>
  )
}
