import { Tldraw, track, useEditor, createShapeId } from '@tldraw/tldraw'
import type { TLShapeId } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { cnnRecognizer } from '../../lib/cnnRecognizer'
import type { Point } from '../../lib/cnnRecognizer'
import { useEffect, useRef, useState } from 'react'
import { UserProfile } from '../Auth/UserProfile'
import { AutoSaveHandler } from './AutoSaveHandler'
import { YjsSyncBridge, type Collaborator } from './YjsSyncBridge'
import { CollaboratorCursors } from './CollaboratorCursors'
import { CollaboratorList } from './CollaboratorList'
import { ConnectionStatus } from './ConnectionStatus'
import { ShareButton } from './ShareButton'

function SaveStatusIndicator({
  isSaving,
  lastSavedAt,
}: {
  isSaving: boolean
  lastSavedAt: Date | null
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1rem',
        right: '1rem',
        zIndex: 1000,
        background: 'white',
        padding: '0.5rem 0.75rem',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontSize: '0.75rem',
        color: '#666',
      }}
    >
      {isSaving ? (
        <span>Saving...</span>
      ) : lastSavedAt ? (
        <span>Saved {lastSavedAt.toLocaleTimeString()}</span>
      ) : (
        <span>Not saved yet</span>
      )}
    </div>
  )
}

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

            // Confidence threshold for shape recognition
            const threshold = 0.20
            if (result.confidence <= threshold || result.name === 'unknown') {
              console.log(`Low confidence (${(result.confidence * 100).toFixed(1)}%), keeping hand-drawn shape`)
              return
            }

            const bounds = editor.getShapePageBounds(latestShape)
            if (!bounds) return

            const centerX = bounds.x + bounds.width / 2
            const centerY = bounds.y + bounds.height / 2
            const size = Math.max(Math.min(bounds.width, bounds.height), 40)

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
                case 'arrow-left':
                case 'arrow-right':
                case 'arrow-up':
                case 'arrow-down': {
                  const first = points[0]
                  const last = points[points.length - 1]

                  // Find nearby shapes to bind to
                  const allPageShapes = editor.getCurrentPageShapes()
                  const geoShapes = allPageShapes.filter(s => s.type === 'geo')

                  const SNAP_DISTANCE = 50 // pixels

                  // Helper function to find nearest shape to a point
                  const findNearestShape = (point: Point) => {
                    let nearestShape = null
                    let minDistance = SNAP_DISTANCE

                    for (const shape of geoShapes) {
                      if (shape.id === latestShape.id) continue
                      const shapeBounds = editor.getShapePageBounds(shape)
                      if (!shapeBounds) continue

                      // Calculate distance to shape center
                      const centerX = shapeBounds.x + shapeBounds.width / 2
                      const centerY = shapeBounds.y + shapeBounds.height / 2
                      const distance = Math.sqrt((point.x - centerX) ** 2 + (point.y - centerY) ** 2)

                      if (distance < minDistance) {
                        minDistance = distance
                        nearestShape = shape
                      }
                    }

                    return nearestShape
                  }

                  const startShape = findNearestShape(first)
                  const endShape = findNearestShape(last)

                  const newArrowId = createShapeId()
                  editor.createShapes([{
                    id: newArrowId,
                    type: 'arrow',
                    x: bounds.x,
                    y: bounds.y,
                    props: {
                      start: startShape ? { type: 'binding', boundShapeId: startShape.id, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false } : { x: first.x - bounds.x, y: first.y - bounds.y },
                      end: endShape ? { type: 'binding', boundShapeId: endShape.id, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false } : { x: last.x - bounds.x, y: last.y - bounds.y },
                      arrowheadStart: 'none',
                      arrowheadEnd: 'arrow',
                      color: (latestShape.props && (latestShape.props as any).color) || undefined,
                      size: (latestShape.props && (latestShape.props as any).size) || undefined,
                    },
                  }])

                  console.log(`Arrow binding: start=${startShape ? 'bound' : 'free'}, end=${endShape ? 'bound' : 'free'}`)
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
                        { id: createShapeId(), index: 'a1' as any, x: first.x - bounds.x, y: first.y - bounds.y },
                        { id: createShapeId(), index: 'a2' as any, x: last.x - bounds.x, y: last.y - bounds.y },
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
  const [saveStatus, setSaveStatus] = useState<{
    isSaving: boolean
    lastSavedAt: Date | null
  }>({ isSaving: false, lastSavedAt: null })

  const [roomId, setRoomId] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  // Parse room ID from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRoomId = params.get('room')
    if (urlRoomId) {
      setRoomId(urlRoomId)
    }
  }, [])

  // When drawing is saved/loaded, use its ID as room ID
  const handleDrawingLoaded = (drawingId: string) => {
    if (!roomId) {
      setRoomId(drawingId)
      // Update URL without reload
      const newUrl = `${window.location.pathname}?room=${drawingId}`
      window.history.replaceState({}, '', newUrl)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <UserProfile />
      {roomId && <ShareButton roomId={roomId} />}
      <CollaboratorList collaborators={collaborators} />
      {roomId && <ConnectionStatus status={connectionStatus} />}
      <SaveStatusIndicator isSaving={saveStatus.isSaving} lastSavedAt={saveStatus.lastSavedAt} />
      <Tldraw>
        <ShapeRecognitionHandler />
        {roomId && (
          <>
            <YjsSyncBridge
              roomId={roomId}
              onCollaboratorsChange={setCollaborators}
              onConnectionStatusChange={setConnectionStatus}
            />
            <CollaboratorCursors collaborators={collaborators} />
          </>
        )}
        <AutoSaveHandler
          onSaveStatusChange={setSaveStatus}
          onDrawingLoaded={handleDrawingLoaded}
          debounceMs={5000}
        />
      </Tldraw>
    </div>
  )
}