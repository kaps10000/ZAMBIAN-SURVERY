import { useState, useRef } from 'react'
import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import { isInZambia, utmToWgs84 } from '../utils/coordinates'

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

export default function FileImport({ onImportPoints, currentUtmZone }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [foundCoordinates, setFoundCoordinates] = useState([])
  const [step, setStep] = useState('upload') // 'upload' | 'paste' | 'settings' | 'preview'
  const [settings, setSettings] = useState({
    coordSystem: 'utm',
    utmZone: currentUtmZone || 35,
    hemisphere: 'S'
  })
  const [manualText, setManualText] = useState('')
  const fileInputRef = useRef(null)

  const resetState = () => {
    setStep('upload')
    setExtractedText('')
    setFoundCoordinates([])
    setProgress('')
    setIsProcessing(false)
    setManualText('')
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsProcessing(true)
    setProgress('Reading file...')

    try {
      let text = ''
      const fileType = file.type
      const fileName = file.name.toLowerCase()

      if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
        // OCR for images with optimized settings for coordinate extraction
        setProgress('Preparing image for OCR...')

        // Create image element for preprocessing
        const img = new Image()
        const imageUrl = URL.createObjectURL(file)

        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageUrl
        })

        // Create canvas for preprocessing
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        // Scale image - larger is better for OCR (but not too large)
        const minSize = 1500
        const maxSize = 3000
        let width = img.width
        let height = img.height

        // Scale up small images for better OCR
        if (width < minSize && height < minSize) {
          const scale = minSize / Math.min(width, height)
          width *= scale
          height *= scale
        }

        // Scale down very large images
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height)
          width *= scale
          height *= scale
        }

        canvas.width = width
        canvas.height = height

        // Draw original image
        ctx.drawImage(img, 0, 0, width, height)

        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        // Convert to grayscale and apply contrast enhancement + thresholding
        for (let i = 0; i < data.length; i += 4) {
          // Convert to grayscale
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]

          // Increase contrast
          let enhanced = ((gray - 128) * 1.5) + 128
          enhanced = Math.max(0, Math.min(255, enhanced))

          // Apply threshold for cleaner text (binarization)
          const threshold = 140
          const final = enhanced < threshold ? 0 : 255

          data[i] = final     // R
          data[i + 1] = final // G
          data[i + 2] = final // B
          // Alpha stays the same
        }

        ctx.putImageData(imageData, 0, 0)

        URL.revokeObjectURL(imageUrl)

        setProgress('Performing OCR (this may take a moment)...')

        // Try OCR with settings optimized for tables/documents
        const result = await Tesseract.recognize(canvas, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(`OCR: ${Math.round(m.progress * 100)}%`)
            }
          },
          tessedit_pageseg_mode: '6', // Assume uniform block of text
          preserve_interword_spaces: '1'
        })
        text = result.data.text

        // If first attempt got poor results, try with different settings
        if (text.replace(/[^0-9]/g, '').length < 10) {
          setProgress('Trying alternate OCR settings...')
          const result2 = await Tesseract.recognize(canvas, 'eng', {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                setProgress(`OCR pass 2: ${Math.round(m.progress * 100)}%`)
              }
            },
            tessedit_pageseg_mode: '4' // Assume single column of variable sizes
          })
          if (result2.data.text.replace(/[^0-9]/g, '').length > text.replace(/[^0-9]/g, '').length) {
            text = result2.data.text
          }
        }

        // If OCR result still has few numbers, it likely failed
        if (text.replace(/[^0-9]/g, '').length < 10) {
          setProgress('OCR could not read numbers well. Try pasting text manually.')
        }
      } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        // PDF extraction
        setProgress('Extracting text from PDF...')
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        for (let i = 1; i <= pdf.numPages; i++) {
          setProgress(`Reading PDF page ${i}/${pdf.numPages}...`)
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          text += textContent.items.map(item => item.str).join(' ') + '\n'
        }
      } else if (fileName.match(/\.(txt|csv)$/)) {
        // Plain text/CSV
        text = await file.text()
      } else if (fileName.match(/\.(doc|docx)$/)) {
        // For Word docs, we'll try to read as text (basic support)
        setProgress('Reading document...')
        try {
          const arrayBuffer = await file.arrayBuffer()
          // Try to extract text from docx (it's a zip with XML)
          const JSZip = (await import('jszip')).default
          const zip = await JSZip.loadAsync(arrayBuffer)
          const docXml = await zip.file('word/document.xml')?.async('text')
          if (docXml) {
            // Extract text between XML tags
            text = docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
          }
        } catch {
          setProgress('Could not read Word doc. Try saving as PDF or text.')
          setIsProcessing(false)
          return
        }
      } else {
        // Try as plain text
        text = await file.text()
      }

      setExtractedText(text)
      setProgress('Text extracted. Configure settings...')
      setStep('settings')
    } catch (error) {
      console.error('Error processing file:', error)
      setProgress(`Error: ${error.message}`)
    }

    setIsProcessing(false)
  }

  const parseCoordinates = () => {
    setIsProcessing(true)
    setProgress('Parsing coordinates...')

    const coords = []
    // Clean up common OCR errors before parsing
    let text = extractedText
      .replace(/[oO]/g, (match, offset, string) => {
        // Replace O with 0 only if surrounded by digits
        const before = string[offset - 1]
        const after = string[offset + 1]
        if ((before && /\d/.test(before)) || (after && /\d/.test(after))) {
          return '0'
        }
        return match
      })
      .replace(/[lI]/g, '1') // Common OCR error: l or I as 1
      .replace(/[Ss]/g, (match, offset, string) => {
        // Replace S with 5 only if surrounded by digits
        const before = string[offset - 1]
        const after = string[offset + 1]
        if ((before && /\d/.test(before)) || (after && /\d/.test(after))) {
          return '5'
        }
        return match
      })
      .replace(/,\s*/g, ', ') // Normalize comma spacing
      .replace(/\s+/g, ' ') // Normalize whitespace

    // Common coordinate patterns
    const patterns = [
      // UTM: 500000.00, 8300000.00 or 500000.00 8300000.00
      /(\d{5,7}(?:\.\d+)?)[,\s]+(\d{6,8}(?:\.\d+)?)/g,
      // Lat/Long: -15.123456, 28.123456
      /(-?\d{1,2}\.\d{4,8})[,\s]+(-?\d{1,3}\.\d{4,8})/g,
      // DMS: 15°23'45"S 28°19'30"E
      /(\d{1,2})°(\d{1,2})'(\d{1,2}(?:\.\d+)?)"?([NS])[,\s]+(\d{1,3})°(\d{1,2})'(\d{1,2}(?:\.\d+)?)"?([EW])/gi,
    ]

    // Try UTM pattern first if UTM is selected
    if (settings.coordSystem === 'utm') {
      // Multiple patterns to catch different formats
      const utmPatterns = [
        /(\d{5,7}(?:\.\d+)?)[,\s]+(\d{6,8}(?:\.\d+)?)/g, // Standard: 680011, 8550258
        /[EeXx][:\s]*(\d{5,7}(?:\.\d+)?)[,\s]*[NnYy][:\s]*(\d{6,8}(?:\.\d+)?)/g, // E: 680011 N: 8550258
        /(\d{6,7})[\s,]+(\d{7,8})/g, // Simple: 680011 8550258
      ]

      for (const utmPattern of utmPatterns) {
        let match
        while ((match = utmPattern.exec(text)) !== null) {
          const easting = parseFloat(match[1])
          const northing = parseFloat(match[2])

          // Validate UTM ranges (easting 100000-900000, northing for S hemisphere)
          if (easting >= 100000 && easting <= 900000 && northing >= 7000000 && northing <= 11000000) {
            try {
              const { lat, lng } = utmToWgs84(easting, northing, settings.utmZone, settings.hemisphere)
              if (isInZambia(lat, lng)) {
                // Check if we already have this coordinate (avoid duplicates)
                const exists = coords.some(c =>
                  Math.abs(c.easting - easting) < 1 && Math.abs(c.northing - northing) < 1
                )
                if (!exists) {
                  coords.push({
                    original: `${easting}, ${northing}`,
                    easting,
                    northing,
                    lat,
                    lng,
                    valid: true
                  })
                }
              }
            } catch (e) {
              // Skip invalid coordinates
            }
          }
        }
      }
    } else {
      // WGS84 pattern
      const wgsPattern = /(-?\d{1,2}\.\d{4,8})[,\s]+(-?\d{1,3}\.\d{4,8})/g
      let match
      while ((match = wgsPattern.exec(text)) !== null) {
        const lat = parseFloat(match[1])
        const lng = parseFloat(match[2])

        if (isInZambia(lat, lng)) {
          coords.push({
            original: `${lat}, ${lng}`,
            lat,
            lng,
            valid: true
          })
        }
      }
    }

    setFoundCoordinates(coords)
    setStep('preview')
    setIsProcessing(false)
    setProgress(`Found ${coords.length} valid coordinates`)
  }

  const handleImport = () => {
    const points = foundCoordinates.map(coord => ({
      lat: coord.lat,
      lng: coord.lng
    }))
    onImportPoints(points)
    setIsOpen(false)
    resetState()
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="import-btn"
        style={{
          width: '100%',
          padding: '0.75rem',
          background: '#D97757',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          marginBottom: '0.5rem'
        }}
      >
        Import from File
      </button>
    )
  }

  return (
    <div className="import-modal" style={{
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
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Import Coordinates</h3>
          <button onClick={() => { setIsOpen(false); resetState(); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </div>

        {step === 'upload' && (
          <div>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Choose how to import coordinates:
            </p>

            {/* Manual paste option - best for mobile */}
            <button
              onClick={() => setStep('paste')}
              style={{
                width: '100%',
                padding: '1rem',
                marginBottom: '0.75rem',
                border: '2px solid #D97757',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '0.95rem',
                color: '#D97757',
                fontWeight: '500'
              }}
            >
              Type/Paste Coordinates (Recommended)
            </button>

            <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '0.75rem', textAlign: 'center' }}>
              - or upload a file -
            </p>

            {/* File input for selecting from gallery/files */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,.pdf,.txt,.csv,.doc,.docx"
              style={{ display: 'none' }}
            />

            {/* Camera input for taking photo (mobile only) */}
            <input
              type="file"
              id="cameraInput"
              onChange={handleFileSelect}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
            />

            {/* Desktop view - single button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="desktop-only"
              style={{
                width: '100%',
                padding: '2rem',
                border: '2px dashed #ddd',
                borderRadius: '8px',
                background: '#f9f9f9',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              {isProcessing ? progress : 'Click to select file'}
            </button>

            {/* Mobile view - two buttons */}
            <div className="mobile-only" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: '1rem',
                  border: '2px dashed #ddd',
                  borderRadius: '8px',
                  background: '#f9f9f9',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                {isProcessing ? progress : 'Select File'}
              </button>

              <button
                onClick={() => document.getElementById('cameraInput')?.click()}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: '1rem',
                  border: '2px solid #D97757',
                  borderRadius: '8px',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: '#D97757'
                }}
              >
                Take Photo
              </button>
            </div>

            <p className="mobile-only" style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', margin: 0 }}>
              Tip: For best results, use good lighting and hold steady
            </p>
          </div>
        )}

        {step === 'paste' && (
          <div>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Type or paste your coordinates below. One pair per line:
            </p>

            <div style={{ background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
              <strong>Example formats:</strong><br/>
              680011, 8550257<br/>
              680219.533 8550400.523<br/>
              E: 680276 N: 8550433
            </div>

            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="680011.389, 8550257.482
680219.533, 8550400.523
680276.903, 8550433.172
680429.824, 8550157.706
680230.069, 8549966.487"
              style={{
                width: '100%',
                height: '150px',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={() => setStep('upload')}
                style={{ flex: 1, padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={() => {
                  setExtractedText(manualText)
                  setStep('settings')
                }}
                disabled={!manualText.trim()}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: manualText.trim() ? '#D97757' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: manualText.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 'settings' && (
          <div>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Configure how to interpret the coordinates:
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Coordinate System:
              </label>
              <select
                value={settings.coordSystem}
                onChange={(e) => setSettings({ ...settings, coordSystem: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="utm">UTM (Easting, Northing)</option>
                <option value="wgs84">WGS84 (Latitude, Longitude)</option>
              </select>
            </div>

            {settings.coordSystem === 'utm' && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    UTM Zone:
                  </label>
                  <select
                    value={settings.utmZone}
                    onChange={(e) => setSettings({ ...settings, utmZone: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    <option value={34}>Zone 34 (Western Zambia)</option>
                    <option value={35}>Zone 35 (Central Zambia)</option>
                    <option value={36}>Zone 36 (Eastern Zambia)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Hemisphere:
                  </label>
                  <select
                    value={settings.hemisphere}
                    onChange={(e) => setSettings({ ...settings, hemisphere: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    <option value="S">South (Zambia)</option>
                    <option value="N">North</option>
                  </select>
                </div>
              </>
            )}

            <div style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', maxHeight: '150px', overflow: 'auto' }}>
              <strong style={{ fontSize: '0.8rem' }}>Extracted text preview:</strong>
              <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', margin: '0.5rem 0 0 0' }}>
                {extractedText.substring(0, 500)}{extractedText.length > 500 ? '...' : ''}
              </pre>
            </div>

            {extractedText.trim().length < 30 && (
              <div style={{ background: '#fff3cd', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
                <p style={{ margin: 0, color: '#856404', fontSize: '0.85rem' }}>
                  OCR didn't extract much text.
                  <button
                    onClick={() => setStep('paste')}
                    style={{ background: 'none', border: 'none', color: '#D97757', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Try typing/pasting manually instead
                  </button>
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setStep('upload')}
                style={{ flex: 1, padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={parseCoordinates}
                disabled={isProcessing}
                style={{ flex: 1, padding: '0.75rem', background: '#D97757', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Find Coordinates
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Found <strong>{foundCoordinates.length}</strong> valid coordinates in Zambia:
            </p>

            {foundCoordinates.length === 0 ? (
              <div style={{ background: '#fff3cd', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
                <p style={{ margin: 0, color: '#856404' }}>
                  No valid coordinates found. Try adjusting the coordinate system or zone settings.
                </p>
              </div>
            ) : (
              <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '1rem' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>#</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Original</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Lat/Lng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foundCoordinates.map((coord, i) => (
                      <tr key={i}>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{i + 1}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>{coord.original}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>
                          {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setStep('settings')}
                style={{ flex: 1, padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={foundCoordinates.length === 0}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: foundCoordinates.length > 0 ? '#D97757' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: foundCoordinates.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                Import {foundCoordinates.length} Points
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
