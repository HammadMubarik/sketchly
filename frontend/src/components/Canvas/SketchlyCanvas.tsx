import { Tldraw, track, useEditor, createShapeId } from '@tldraw/tldraw'
import type { TLShapeId } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { cnnRecognizer } from '../../lib/cnnRecognizer'
import type { Point } from '../../lib/cnnRecognizer'
import { useEffect, useRef } from 'react'

const ShapeRecognitionHandler = track(() => {
  const editor = useEditor()
  const lastShapeIdRef = useRef<TLShapeId | null>(null)
  const processingRef = useRef(false)

  useEffect(() => {
    const handlePointerUp = () => {
      // Small delay to let tldraw finish creating the shape
      setTimeout(() => {
        if (processingRef.current) return
        processingRef.current = true

        ;(async () => {
          try {
            const allShapes = editor.getCurrentPageShapes()
            const drawShapes = allShapes.filter(s => s.type === 'draw')

            if (drawShapes.length === 0) return

            const latestShape = drawShapes[drawShapes.length - 1]
            if (latestShape.id === lastShapeIdRef.current) return

            console.log('New shape drawn, analyzing...')

            const points: Point[] = []
            const shapeProps = latestShape.props as any
            const segments = shapeProps.segments
            if (segments && segments.length > 0) {
              for (const segment of segments) {
                if (segment.points) {
                  for (const point of segment.points) {
                    points.push({ x: (point.x || 0) + (latestShape.x || 0), y: (point.y || 0) + (latestShape.y || 0) })
                  }
                }
              }
            }

            if (points.length < 10) {
              console.log(`Not enough points (${points.length}), need at least 10`)
              return
            }

            console.log(`Analyzing ${points.length} points with CNN...`)
            let result = { name: 'unknown', confidence: 0 }

            try {
              // Try CNN recognizer first
              result = await cnnRecognizer.recognize(points)
              console.log(`CNN Detected: ${result.name} (${(result.confidence * 100).toFixed(1)}% confidence)`)
            } catch (cnnError) {
              console.error('CNN recognition failed, falling back to backend API:', cnnError)

              // Fallback to backend API
              try {
                const apiBase = window.location.port === '5173' ? 'http://localhost:5000' : ''
                const resp = await fetch(apiBase + '/api/recognize', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ points }),
                })
                if (resp.ok) {
                  result = await resp.json()
                  console.log(`Backend API Detected: ${result.name} (${(result.confidence * 100).toFixed(1)}%)`)
                }
              } catch (apiErr) {
                console.error('All recognition methods failed:', apiErr)
                return
              }
            }

            lastShapeIdRef.current = latestShape.id

            // Lower threshold for backend API (0.35) since it uses different algorithm
            // CNN will use 0.7 when model is trained
            const threshold = result.confidence > 1 ? 0.7 : 0.35
            if (result.confidence <= threshold || result.name === 'unknown') {
              console.log(`Low confidence (${(result.confidence * 100).toFixed(1)}%), keeping hand-drawn shape`)
              return
            }

            const bounds = editor.getShapePageBounds(latestShape)
            if (!bounds) return

            const centerX = bounds.x + bounds.width / 2
            const centerY = bounds.y + bounds.height / 2
            const size = Math.max(Math.min(bounds.width, bounds.height), 40)

            if (result.name === 'check' || result.name === 'x') {
              console.log(`Keeping hand-drawn ${result.name}`)
              return
            }

            try {
              switch (result.name) {
                case 'rectangle':
                  editor.createShapes([{
                    id: createShapeId(),
                    type: 'geo',
                    x: bounds.x,
                    y: bounds.y,
                    props: { geo: 'rectangle', w: bounds.width, h: bounds.height },
                  }])
                  break
                case 'square':
                  editor.createShapes([{
                    id: createShapeId(),
                    type: 'geo',
                    x: centerX - size / 2,
                    y: centerY - size / 2,
                    props: { geo: 'rectangle', w: size, h: size },
                  }])
                  break
                case 'circle':
                  editor.createShapes([{
                    id: createShapeId(),
                    type: 'geo',
                    x: centerX - size / 2,
                    y: centerY - size / 2,
                    props: { geo: 'ellipse', w: size, h: size },
                  }])
                  break
                case 'triangle':
                  editor.createShapes([{
                    id: createShapeId(),
                    type: 'geo',
                    x: bounds.x,
                    y: bounds.y,
                    props: { geo: 'triangle', w: bounds.width, h: bounds.height },
                  }])
                  break
                case 'diamond':
                  editor.createShapes([{
                    id: createShapeId(),
                    type: 'geo',
                    x: bounds.x,
                    y: bounds.y,
                    props: { geo: 'diamond', w: bounds.width, h: bounds.height },
                  }])
                  break
                case 'star':
                  editor.createShapes([{
                    id: createShapeId(),
                    type: 'geo',
                    x: centerX - size / 2,
                    y: centerY - size / 2,
                    props: { geo: 'star', w: size, h: size },
                  }])
                  break
                case 'arrow': {
                  const first = points[0]
                  const last = points[points.length - 1]
                  editor.createShapes([{
                    id: createShapeId(),
                    type: 'arrow',
                    x: bounds.x,
                    y: bounds.y,
                    props: {
                      start: { x: first.x - bounds.x, y: first.y - bounds.y },
                      end: { x: last.x - bounds.x, y: last.y - bounds.y },
                      arrowheadStart: 'none',
                      arrowheadEnd: 'none',
                      color: (latestShape.props && (latestShape.props as any).color) || undefined,
                      size: (latestShape.props && (latestShape.props as any).size) || undefined,
                    },
                  }])
                  break
                }
                case 'line': {
                  const first = points[0]
                  const last = points[points.length - 1]
                  editor.createShapes([{
                    id: createShapeId(),
                    type: 'line',
                    x: bounds.x,
                    y: bounds.y,
                    props: {
                      points: [
                        { id: createShapeId(), index: 0, x: first.x - bounds.x, y: first.y - bounds.y },
                        { id: createShapeId(), index: 1, x: last.x - bounds.x, y: last.y - bounds.y },
                      ],
                      color: (latestShape.props && (latestShape.props as any).color) || undefined,
                      size: (latestShape.props && (latestShape.props as any).size) || undefined,
                    },
                  }])
                  break
                }
                default:
                  console.log(`Unknown shape type: ${result.name}, keeping original`)
                  return // Don't delete the original shape
              }

              // Delete original only after successful create
              editor.deleteShapes([latestShape.id])
              console.log('Shape converted successfully!')
            } catch (createErr) {
              console.error('Error creating shape:', createErr)
              try { editor.undo() } catch { /* ignore */ }
            }
          } catch (error) {
            console.error('Error during recognition:', error)
          } finally {
            processingRef.current = false
          }
        })()
      }, 100) // Short delay to ensure shape is fully created
    }

    // Listen for pointerup on the window (fires when user releases the mouse/finger).
    // Using the store listener caused premature triggers while the user was still
    // holding the mouse button (selectedShapes can be empty mid-draw). The global
    // pointerup ensures we only try to finalize recognition when the user actually releases.
    const onWindowPointerUp = () => {
      // Only act if the drawing tool is active; otherwise ignore
      if (editor.getCurrentToolId && editor.getCurrentToolId() === 'draw') {
        handlePointerUp()
      }
    }

    window.addEventListener('pointerup', onWindowPointerUp)

    // Also listen for tool changes
    let lastToolId = editor.getCurrentToolId()
    const toolCheckInterval = setInterval(() => {
      const currentToolId = editor.getCurrentToolId()
      if (lastToolId === 'draw' && currentToolId !== 'draw') {
        handlePointerUp()
      }
      lastToolId = currentToolId
    }, 200)

    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp)
      clearInterval(toolCheckInterval)
    }
  }, [editor])

  return null
})

export function SketchlyCanvas() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {/* Info banner */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'white',
          padding: '14px 28px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '2px solid #10b981',
          animation: 'fadeIn 0.5s ease-in',
        }}
      >
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
              to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.6; }
            }
          `}
        </style>
        <div>
          <div style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '14px' }}>
            Instant Shape Recognition
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Draw with pen tool - shapes auto-convert when you release!
          </div>
        </div>
      </div>

      <Tldraw>
        <ShapeRecognitionHandler />
      </Tldraw>
    </div>
  )
}