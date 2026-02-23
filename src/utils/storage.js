import { openDB } from 'idb'

const DB_NAME = 'survey-tool'
const DB_VERSION = 1
const STORE_NAME = 'projects'

// Initialize the database
async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' })
      }
    }
  })
}

// Save a project to IndexedDB
export async function saveProject(name, project) {
  const db = await getDB()
  await db.put(STORE_NAME, { ...project, name })
  return true
}

// Load a project from IndexedDB
export async function loadProject(name) {
  const db = await getDB()
  return db.get(STORE_NAME, name)
}

// List all saved projects
export async function listProjects() {
  const db = await getDB()
  const projects = await db.getAll(STORE_NAME)
  return projects.map(p => p.name)
}

// Delete a project
export async function deleteProject(name) {
  const db = await getDB()
  await db.delete(STORE_NAME, name)
  return true
}

// Export project as JSON file
export function exportProjectAsJSON(project) {
  const dataStr = JSON.stringify(project, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${project.name || 'survey'}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Import project from JSON file
export function importProjectFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const project = JSON.parse(e.target.result)
        resolve(project)
      } catch (err) {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

// Export points as CSV
export function exportPointsAsCSV(points, coordinateSystem) {
  let csv = coordinateSystem === 'utm'
    ? 'Point,Easting,Northing,Zone\n'
    : 'Point,Latitude,Longitude\n'

  points.forEach((point, index) => {
    if (coordinateSystem === 'utm') {
      // Would need to convert here
      csv += `${index + 1},${point.lng},${point.lat},32N\n`
    } else {
      csv += `${index + 1},${point.lat},${point.lng}\n`
    }
  })

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = 'survey-points.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
