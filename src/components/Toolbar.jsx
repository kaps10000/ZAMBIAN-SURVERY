import { useState, createContext, useContext } from 'react'

// Create context for sharing active tool across components
export const ToolContext = createContext({
  activeTool: 'select',
  setActiveTool: () => {}
})

export function useToolContext() {
  return useContext(ToolContext)
}

export function ToolProvider({ children }) {
  const [activeTool, setActiveTool] = useState('select')

  return (
    <ToolContext.Provider value={{ activeTool, setActiveTool }}>
      {children}
    </ToolContext.Provider>
  )
}

const tools = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'pan', label: 'Pan', icon: '✋' },
  { separator: true },
  { id: 'line', label: 'Line', icon: '/' },
  { id: 'rectangle', label: 'Rectangle', icon: '▢' },
  { id: 'circle', label: 'Circle', icon: '○' },
  { id: 'polygon', label: 'Polygon', icon: '⬡' },
  { separator: true },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'dimension', label: 'Dimension', icon: '↔' },
  { separator: true },
  { id: 'building', label: 'Building', icon: '⌂' },
  { id: 'tree', label: 'Tree', icon: '🌳' },
  { id: 'northArrow', label: 'North', icon: '⬆' }
]

export default function Toolbar() {
  const { activeTool, setActiveTool } = useToolContext()

  return (
    <div className="toolbar">
      {tools.map((tool, index) =>
        tool.separator ? (
          <div key={index} className="tool-separator" />
        ) : (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
          >
            <span>{tool.icon}</span>
            <span>{tool.label}</span>
          </button>
        )
      )}
    </div>
  )
}
