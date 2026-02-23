import { useEffect, useRef, useState } from 'react'
import { Canvas, Rect, Circle, Line, Polygon, Textbox, Group } from 'fabric'
import { useToolContext } from './Toolbar'

export default function SitePlanEditor({ points, objects, onObjectsChange }) {
  const canvasRef = useRef(null)
  const fabricRef = useRef(null)
  const containerRef = useRef(null)
  const { activeTool } = useToolContext()
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState(null)

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (fabricRef.current) return

    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true
    })

    fabricRef.current = canvas

    // Handle resize
    const resizeCanvas = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        canvas.setDimensions({ width, height: height - 50 })
        canvas.renderAll()
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Draw grid
    drawGrid(canvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      canvas.dispose()
      fabricRef.current = null
    }
  }, [])

  // Handle tool changes
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    // Reset drawing mode
    canvas.isDrawingMode = false
    canvas.selection = activeTool === 'select'

    // Set cursor based on tool
    if (activeTool === 'pan') {
      canvas.defaultCursor = 'grab'
    } else if (activeTool === 'select') {
      canvas.defaultCursor = 'default'
    } else {
      canvas.defaultCursor = 'crosshair'
    }
  }, [activeTool])

  // Handle mouse events for drawing
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const handleMouseDown = (opt) => {
      if (activeTool === 'select' || activeTool === 'pan') return

      const pointer = canvas.getViewportPoint(opt.e)
      setIsDrawing(true)
      setStartPoint({ x: pointer.x, y: pointer.y })

      if (activeTool === 'text') {
        const text = new Textbox('Text', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 16,
          fill: '#333333',
          fontFamily: 'Arial'
        })
        canvas.add(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        setIsDrawing(false)
      }
    }

    const handleMouseMove = (opt) => {
      if (!isDrawing || !startPoint) return

      const pointer = canvas.getViewportPoint(opt.e)

      // Remove temporary shape
      const objects = canvas.getObjects()
      const temp = objects.find(o => o.isTemp)
      if (temp) canvas.remove(temp)

      let shape = null
      const width = pointer.x - startPoint.x
      const height = pointer.y - startPoint.y

      if (activeTool === 'rectangle' || activeTool === 'building') {
        shape = new Rect({
          left: Math.min(startPoint.x, pointer.x),
          top: Math.min(startPoint.y, pointer.y),
          width: Math.abs(width),
          height: Math.abs(height),
          fill: activeTool === 'building' ? '#e5e5e5' : 'transparent',
          stroke: activeTool === 'building' ? '#666666' : '#D97757',
          strokeWidth: 2,
          isTemp: true
        })
      } else if (activeTool === 'circle') {
        const radius = Math.sqrt(width * width + height * height) / 2
        shape = new Circle({
          left: startPoint.x - radius,
          top: startPoint.y - radius,
          radius,
          fill: 'transparent',
          stroke: '#D97757',
          strokeWidth: 2,
          isTemp: true
        })
      } else if (activeTool === 'line' || activeTool === 'dimension') {
        shape = new Line([startPoint.x, startPoint.y, pointer.x, pointer.y], {
          stroke: activeTool === 'dimension' ? '#dc2626' : '#2563eb',
          strokeWidth: 2,
          isTemp: true
        })
      }

      if (shape) {
        canvas.add(shape)
        canvas.renderAll()
      }
    }

    const handleMouseUp = (opt) => {
      if (!isDrawing) return
      setIsDrawing(false)

      const canvas = fabricRef.current
      const objects = canvas.getObjects()
      const temp = objects.find(o => o.isTemp)

      if (temp) {
        temp.isTemp = false
        canvas.setActiveObject(temp)

        // Add dimension label for dimension tool
        if (activeTool === 'dimension' && temp.type === 'line') {
          const dx = temp.x2 - temp.x1
          const dy = temp.y2 - temp.y1
          const length = Math.sqrt(dx * dx + dy * dy)
          const label = new Textbox(`${length.toFixed(1)}m`, {
            left: (temp.x1 + temp.x2) / 2,
            top: (temp.y1 + temp.y2) / 2 - 10,
            fontSize: 12,
            fill: '#dc2626',
            fontFamily: 'Arial',
            textAlign: 'center'
          })
          canvas.add(label)
        }

        canvas.renderAll()
      }

      setStartPoint(null)
    }

    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)

    return () => {
      canvas.off('mouse:down', handleMouseDown)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', handleMouseUp)
    }
  }, [activeTool, isDrawing, startPoint])

  // Add symbols
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    if (activeTool === 'tree') {
      const handleClick = (opt) => {
        const pointer = canvas.getViewportPoint(opt.e)
        addTreeSymbol(canvas, pointer.x, pointer.y)
      }
      canvas.on('mouse:down', handleClick)
      return () => canvas.off('mouse:down', handleClick)
    }

    if (activeTool === 'northArrow') {
      const handleClick = (opt) => {
        const pointer = canvas.getViewportPoint(opt.e)
        addNorthArrow(canvas, pointer.x, pointer.y)
      }
      canvas.on('mouse:down', handleClick)
      return () => canvas.off('mouse:down', handleClick)
    }
  }, [activeTool])

  return (
    <div className="site-plan-container" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  )
}

function drawGrid(canvas) {
  const gridSize = 50
  const width = canvas.getWidth()
  const height = canvas.getHeight()

  for (let x = 0; x <= width; x += gridSize) {
    const line = new Line([x, 0, x, height], {
      stroke: '#e5e5e5',
      strokeWidth: 1,
      selectable: false,
      evented: false
    })
    canvas.add(line)
    canvas.sendObjectToBack(line)
  }

  for (let y = 0; y <= height; y += gridSize) {
    const line = new Line([0, y, width, y], {
      stroke: '#e5e5e5',
      strokeWidth: 1,
      selectable: false,
      evented: false
    })
    canvas.add(line)
    canvas.sendObjectToBack(line)
  }
}

function addTreeSymbol(canvas, x, y) {
  const trunk = new Rect({
    left: x - 3,
    top: y,
    width: 6,
    height: 15,
    fill: '#8B4513',
    selectable: false
  })

  const foliage = new Circle({
    left: x - 15,
    top: y - 25,
    radius: 15,
    fill: '#228B22',
    selectable: false
  })

  const tree = new Group([trunk, foliage], {
    left: x - 15,
    top: y - 25
  })

  canvas.add(tree)
  canvas.renderAll()
}

function addNorthArrow(canvas, x, y) {
  const arrow = new Polygon([
    { x: 0, y: -30 },
    { x: 10, y: 10 },
    { x: 0, y: 0 },
    { x: -10, y: 10 }
  ], {
    left: x,
    top: y,
    fill: '#333333',
    stroke: '#333333',
    strokeWidth: 1
  })

  const label = new Textbox('N', {
    left: x - 5,
    top: y - 50,
    fontSize: 14,
    fill: '#333333',
    fontFamily: 'Arial',
    fontWeight: 'bold'
  })

  canvas.add(arrow)
  canvas.add(label)
  canvas.renderAll()
}
