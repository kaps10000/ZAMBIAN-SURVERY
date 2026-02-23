import { useState, useCallback } from 'react'
import MapView from './components/MapView'
import CoordinatePanel from './components/CoordinatePanel'
import AreaCalculator from './components/AreaCalculator'
import SitePlanEditor from './components/SitePlanEditor'
import Toolbar, { ToolProvider } from './components/Toolbar'
import ExportPanel from './components/ExportPanel'
import FileImport from './components/FileImport'
import { saveProject, loadProject, listProjects } from './utils/storage'
import './App.css'

function AppContent() {
  const [points, setPoints] = useState([])
  const [activeTab, setActiveTab] = useState('map') // 'map' | 'sitePlan'
  const [coordinateSystem, setCoordinateSystem] = useState('wgs84') // 'wgs84' | 'utm'
  const [projectName, setProjectName] = useState('')
  const [sitePlanObjects, setSitePlanObjects] = useState([])
  const [utmZone, setUtmZone] = useState(35) // Zambia uses zones 27 and 35

  const handleAddPoint = useCallback((point) => {
    setPoints(prev => [...prev, { ...point, id: Date.now() }])
  }, [])

  const handleUpdatePoint = useCallback((id, updates) => {
    setPoints(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }, [])

  const handleDeletePoint = useCallback((id) => {
    setPoints(prev => prev.filter(p => p.id !== id))
  }, [])

  const handleClearPoints = useCallback(() => {
    setPoints([])
  }, [])

  const handleImportPoints = useCallback((importedPoints) => {
    const newPoints = importedPoints.map((p, index) => ({
      ...p,
      id: Date.now() + index
    }))
    setPoints(prev => [...prev, ...newPoints])
  }, [])

  const handleSave = useCallback(async () => {
    const project = {
      name: projectName,
      points,
      sitePlanObjects,
      coordinateSystem,
      utmZone,
      savedAt: new Date().toISOString()
    }
    await saveProject(projectName, project)
    alert('Project saved!')
  }, [projectName, points, sitePlanObjects, coordinateSystem, utmZone])

  const handleLoad = useCallback(async () => {
    const projects = await listProjects()
    if (projects.length === 0) {
      alert('No saved projects found')
      return
    }
    const name = prompt('Enter project name to load:\n\nAvailable: ' + projects.join(', '))
    if (name) {
      const project = await loadProject(name)
      if (project) {
        setProjectName(project.name)
        setPoints(project.points || [])
        setSitePlanObjects(project.sitePlanObjects || [])
        setCoordinateSystem(project.coordinateSystem || 'wgs84')
        setUtmZone(project.utmZone || 35)
      }
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Zambia Survey Tool</h1>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="project-name-input"
          placeholder="Enter project/applicant name"
        />
        <div className="header-actions">
          <button onClick={handleSave} className="btn btn-primary">Save</button>
          <button onClick={handleLoad} className="btn">Load</button>
        </div>
      </header>

      <div className="app-content">
        <aside className="sidebar">
          <div className="coordinate-system-toggle">
            <label>Coordinate System:</label>
            <select
              value={coordinateSystem}
              onChange={(e) => setCoordinateSystem(e.target.value)}
            >
              <option value="wgs84">WGS84 (Lat/Long)</option>
              <option value="utm">UTM (Meters)</option>
            </select>
          </div>

          {coordinateSystem === 'utm' && (
            <div className="coordinate-system-toggle">
              <label>Origin Zone:</label>
              <select
                value={utmZone}
                onChange={(e) => setUtmZone(parseInt(e.target.value))}
              >
                <option value={35}>Zone 35 (27°E - Eastern Zambia)</option>
                <option value={34}>Zone 34 (21°E - Western Zambia)</option>
                <option value={36}>Zone 36 (33°E - Far Eastern)</option>
              </select>
            </div>
          )}

          <FileImport
            onImportPoints={handleImportPoints}
            currentUtmZone={utmZone}
          />

          <CoordinatePanel
            points={points}
            coordinateSystem={coordinateSystem}
            utmZone={utmZone}
            onAddPoint={handleAddPoint}
            onUpdatePoint={handleUpdatePoint}
            onDeletePoint={handleDeletePoint}
            onClearPoints={handleClearPoints}
          />

          <AreaCalculator
            points={points}
            coordinateSystem={coordinateSystem}
          />

          <ExportPanel
            points={points}
            projectName={projectName}
            coordinateSystem={coordinateSystem}
            utmZone={utmZone}
          />
        </aside>

        <main className="main-content">
          <div className="tab-bar">
            <button
              className={`tab ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              Map View
            </button>
            <button
              className={`tab ${activeTab === 'sitePlan' ? 'active' : ''}`}
              onClick={() => setActiveTab('sitePlan')}
            >
              Site Plan
            </button>
          </div>

          {activeTab === 'map' ? (
            <MapView
              points={points}
              onAddPoint={handleAddPoint}
              onUpdatePoint={handleUpdatePoint}
              coordinateSystem={coordinateSystem}
              utmZone={utmZone}
            />
          ) : (
            <>
              <Toolbar />
              <SitePlanEditor
                points={points}
                objects={sitePlanObjects}
                onObjectsChange={setSitePlanObjects}
              />
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ToolProvider>
      <AppContent />
    </ToolProvider>
  )
}
