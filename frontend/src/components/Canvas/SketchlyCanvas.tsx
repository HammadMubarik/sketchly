import { Tldraw, track, useEditor, createShapeId } from '@tldraw/tldraw'
import type { TLShapeId } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { cnnRecognizer } from '../../lib/cnnRecognizer'
import type { Point } from '../../lib/cnnRecognizer'
import { useEffect, useRef, useState } from 'react'
import { AutoSaveHandler } from './AutoSaveHandler'
import { recordRoomVisit } from '../../lib/drawingStorage'
import { useAuth } from '../../../Contexts/AuthContext'
import { YjsSyncBridge, type Collaborator } from './YjsSyncBridge'
import { CollaboratorCursors } from './CollaboratorCursors'
import { CollaboratorList } from './CollaboratorList'
import { ConnectionStatus } from './ConnectionStatus'
import { ShareButton } from './ShareButton'
import { EditPermissionHandler } from './EditPermissionHandler'
import { ConnectionPoints } from './ConnectionPoints'
import { getAnchorsForGeoType } from '../../lib/connectionPoints'

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
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(8px)',
        padding: '0.4rem 0.75rem',
        borderRadius: '9999px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.06)',
        fontSize: '0.7rem',
        fontWeight: 500,
        color: '#888',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}
    >
      {isSaving ? (
        <>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
          Saving...
        </>
      ) : lastSavedAt ? (
        <>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
          Saved {lastSavedAt.toLocaleTimeString()}
        </>
      ) : (
        <>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d1d5db' }} />
          Not saved yet
        </>
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
            const threshold = 0.55
            if (result.confidence <= threshold || result.name === 'unknown') {
              console.log(`Low confidence (${(result.confidence * 100).toFixed(1)}%), keeping hand-drawn shape`)
              return
            }

            const bounds = editor.getShapePageBounds(latestShape)
            if (!bounds) return

            const centerX = bounds.x + bounds.width / 2
            const centerY = bounds.y + bounds.height / 2
            const size = Math.max(Math.min(bounds.width, bounds.height), 40)

            // Shared snap logic for arrows and lines
            const allPageShapes = editor.getCurrentPageShapes()
            const geoShapes = allPageShapes.filter(s => s.type === 'geo')
            // Zoom-aware snap distance: 80 screen pixels converted to page coordinates
            const zoom = editor.getZoomLevel()
            const SNAP_DISTANCE = 80 / zoom

            const findNearestSnap = (point: Point) => {
              let bestShape: typeof geoShapes[0] | null = null
              let bestAnchor = { x: 0.5, y: 0.5 }
              let bestPagePos = { x: 0, y: 0 }
              let minDistance = SNAP_DISTANCE

              for (const shape of geoShapes) {
                if (shape.id === latestShape.id) continue
                const shapeBounds = editor.getShapePageBounds(shape)
                if (!shapeBounds) continue

                const geoType = (shape.props as any).geo as string
                const anchors = getAnchorsForGeoType(geoType)
                const pts = anchors.length > 0 ? anchors : [{ x: 0.5, y: 0.5 }]

                for (const anchor of pts) {
                  const px = shapeBounds.x + anchor.x * shapeBounds.width
                  const py = shapeBounds.y + anchor.y * shapeBounds.height
                  const distance = Math.sqrt((point.x - px) ** 2 + (point.y - py) ** 2)

                  if (distance < minDistance) {
                    minDistance = distance
                    bestShape = shape
                    bestAnchor = anchor
                    bestPagePos = { x: px, y: py }
                  }
                }
              }

              return bestShape ? { shape: bestShape, anchor: bestAnchor, pagePos: bestPagePos } : null
            }

            // Track newly created geo shape for auto-connection
            let newGeoShapeId: TLShapeId | null = null

            try {
              switch (result.name) {
                case 'rectangle': {
                  const id = createShapeId()
                  newGeoShapeId = id
                  editor.createShapes([{
                    id,
                    type: 'geo',
                    x: bounds.x,
                    y: bounds.y,
                    props: { geo: 'rectangle', w: bounds.width, h: bounds.height },
                  }])
                  break
                }
                case 'square': {
                  const id = createShapeId()
                  newGeoShapeId = id
                  editor.createShapes([{
                    id,
                    type: 'geo',
                    x: centerX - size / 2,
                    y: centerY - size / 2,
                    props: { geo: 'rectangle', w: size, h: size },
                  }])
                  break
                }
                case 'circle': {
                  const id = createShapeId()
                  newGeoShapeId = id
                  editor.createShapes([{
                    id,
                    type: 'geo',
                    x: centerX - size / 2,
                    y: centerY - size / 2,
                    props: { geo: 'ellipse', w: size, h: size },
                  }])
                  break
                }
                case 'triangle': {
                  const id = createShapeId()
                  newGeoShapeId = id
                  editor.createShapes([{
                    id,
                    type: 'geo',
                    x: bounds.x,
                    y: bounds.y,
                    props: { geo: 'triangle', w: bounds.width, h: bounds.height },
                  }])
                  break
                }
                case 'diamond': {
                  const id = createShapeId()
                  newGeoShapeId = id
                  editor.createShapes([{
                    id,
                    type: 'geo',
                    x: bounds.x,
                    y: bounds.y,
                    props: { geo: 'diamond', w: bounds.width, h: bounds.height },
                  }])
                  break
                }
                case 'arrow-left':
                case 'arrow-right':
                case 'arrow-up':
                case 'arrow-down': {
                  const first = points[0]
                  const last = points[points.length - 1]

                  const startSnap = findNearestSnap(first)
                  const endSnap = findNearestSnap(last)

                  // Use snap point page positions for arrow endpoints when available
                  const startX = startSnap ? startSnap.pagePos.x - bounds.x : first.x - bounds.x
                  const startY = startSnap ? startSnap.pagePos.y - bounds.y : first.y - bounds.y
                  const endX = endSnap ? endSnap.pagePos.x - bounds.x : last.x - bounds.x
                  const endY = endSnap ? endSnap.pagePos.y - bounds.y : last.y - bounds.y

                  const newArrowId = createShapeId()
                  editor.createShapes([{
                    id: newArrowId,
                    type: 'arrow',
                    x: bounds.x,
                    y: bounds.y,
                    props: {
                      start: { x: startX, y: startY },
                      end: { x: endX, y: endY },
                      arrowheadStart: 'none',
                      arrowheadEnd: 'arrow',
                      color: (latestShape.props && (latestShape.props as any).color) || undefined,
                      size: (latestShape.props && (latestShape.props as any).size) || undefined,
                    },
                  }])

                  // Create bindings to snap arrow endpoints to connection points
                  if (startSnap) {
                    try {

                      editor.createBinding({
                        type: 'arrow',
                        fromId: newArrowId,
                        toId: startSnap.shape.id,
                        props: { terminal: 'start', normalizedAnchor: { x: startSnap.anchor.x, y: startSnap.anchor.y }, isExact: false, isPrecise: true },
                      })

                    } catch (e) { console.warn('Failed to bind arrow start:', e) }
                  }
                  if (endSnap) {
                    try {
                      editor.createBinding({
                        type: 'arrow',
                        fromId: newArrowId,
                        toId: endSnap.shape.id,
                        props: { terminal: 'end', normalizedAnchor: { x: endSnap.anchor.x, y: endSnap.anchor.y }, isExact: false, isPrecise: true },
                      })
                    } catch (e) { console.warn('Failed to bind arrow end:', e) }
                  }
                  break
                }
                case 'line': {
                  const first = points[0]
                  const last = points[points.length - 1]

                  // Check if either endpoint is near a connection point
                  const lineStartSnap = findNearestSnap(first)
                  const lineEndSnap = findNearestSnap(last)

                  if (lineStartSnap || lineEndSnap) {
                    const lStartX = lineStartSnap ? lineStartSnap.pagePos.x - bounds.x : first.x - bounds.x
                    const lStartY = lineStartSnap ? lineStartSnap.pagePos.y - bounds.y : first.y - bounds.y
                    const lEndX = lineEndSnap ? lineEndSnap.pagePos.x - bounds.x : last.x - bounds.x
                    const lEndY = lineEndSnap ? lineEndSnap.pagePos.y - bounds.y : last.y - bounds.y

                    // Create a bound arrow (no arrowheads) instead of a plain line
                    const lineArrowId = createShapeId()
                    editor.createShapes([{
                      id: lineArrowId,
                      type: 'arrow',
                      x: bounds.x,
                      y: bounds.y,
                      props: {
                        start: { x: lStartX, y: lStartY },
                        end: { x: lEndX, y: lEndY },
                        arrowheadStart: 'none',
                        arrowheadEnd: 'none',
                        color: (latestShape.props && (latestShape.props as any).color) || undefined,
                        size: (latestShape.props && (latestShape.props as any).size) || undefined,
                      },
                    }])

                    if (lineStartSnap) {
                      try {
                        editor.createBinding({
                          type: 'arrow',
                          fromId: lineArrowId,
                          toId: lineStartSnap.shape.id,
                          props: { terminal: 'start', normalizedAnchor: { x: lineStartSnap.anchor.x, y: lineStartSnap.anchor.y }, isExact: false, isPrecise: true },
                        })
                      } catch (e) { console.warn('Failed to bind line start:', e) }
                    }
                    if (lineEndSnap) {
                      try {
                        editor.createBinding({
                          type: 'arrow',
                          fromId: lineArrowId,
                          toId: lineEndSnap.shape.id,
                          props: { terminal: 'end', normalizedAnchor: { x: lineEndSnap.anchor.x, y: lineEndSnap.anchor.y }, isExact: false, isPrecise: true },
                        })
                      } catch (e) { console.warn('Failed to bind line end:', e) }
                    }
                  } else {
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
                  }
                  break
                }
                default:
                  console.log(`Unknown shape type: ${result.name}, keeping original`)
                  return // Don't delete the original shape
              }

              // Delete original only after successful create
              editor.deleteShapes([latestShape.id])
              console.log('Shape converted successfully!')

              // Auto-snap: if a new geo shape was created, check if any of its
              // connection points are near connection points of existing shapes.
              // If so, reposition the new shape so they touch exactly.
              if (newGeoShapeId) {
                const newShape = editor.getShape(newGeoShapeId)
                if (newShape) {
                  const newBounds = editor.getShapePageBounds(newShape)
                  const newGeoType = (newShape.props as any).geo as string
                  const newAnchors = getAnchorsForGeoType(newGeoType)

                  if (newBounds && newAnchors.length > 0) {
                    const existingGeoShapes = editor.getCurrentPageShapes()
                      .filter(s => s.type === 'geo' && s.id !== newGeoShapeId)

                    const AUTO_SNAP_DISTANCE = 60 / zoom

                    // Find the closest pair of connection points between the new shape and any existing shape
                    let bestMatch: { newAnchor: { x: number; y: number }; otherPx: number; otherPy: number; newPx: number; newPy: number; dist: number } | null = null

                    for (const newAnchor of newAnchors) {
                      const newPx = newBounds.x + newAnchor.x * newBounds.width
                      const newPy = newBounds.y + newAnchor.y * newBounds.height

                      for (const other of existingGeoShapes) {
                        const otherBounds = editor.getShapePageBounds(other)
                        if (!otherBounds) continue
                        const otherAnchors = getAnchorsForGeoType((other.props as any).geo as string)
                        if (otherAnchors.length === 0) continue

                        for (const otherAnchor of otherAnchors) {
                          const oPx = otherBounds.x + otherAnchor.x * otherBounds.width
                          const oPy = otherBounds.y + otherAnchor.y * otherBounds.height
                          const dist = Math.sqrt((newPx - oPx) ** 2 + (newPy - oPy) ** 2)

                          if (dist < AUTO_SNAP_DISTANCE && (!bestMatch || dist < bestMatch.dist)) {
                            bestMatch = { newAnchor, otherPx: oPx, otherPy: oPy, newPx, newPy, dist }
                          }
                        }
                      }
                    }

                    if (bestMatch) {
                      // Move the new shape so its connection point aligns exactly with the other shape's connection point
                      const dx = bestMatch.otherPx - bestMatch.newPx
                      const dy = bestMatch.otherPy - bestMatch.newPy
                      editor.updateShape({
                        id: newGeoShapeId,
                        type: 'geo',
                        x: newShape.x + dx,
                        y: newShape.y + dy,
                      })
                      console.log(`Auto-snapped ${newGeoType} to align connection points`)
                    }
                  }
                }
              }
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
  const { user } = useAuth()
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

  // Record room visit whenever roomId is established
  useEffect(() => {
    if (!roomId || !user?.id) return

    const roomName = `Room ${roomId.slice(0, 8)}`
    recordRoomVisit(user.id, roomId, roomName)
  }, [roomId, user?.id])

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
      {roomId && <ShareButton roomId={roomId} />}
      <CollaboratorList collaborators={collaborators} />
      {roomId && <ConnectionStatus status={connectionStatus} />}
      <SaveStatusIndicator isSaving={saveStatus.isSaving} lastSavedAt={saveStatus.lastSavedAt} />
      <Tldraw>
        <ShapeRecognitionHandler />
        <ConnectionPoints />
        {roomId && (
          <>
            <YjsSyncBridge
              roomId={roomId}
              onCollaboratorsChange={setCollaborators}
              onConnectionStatusChange={setConnectionStatus}
            />
            <CollaboratorCursors collaborators={collaborators} />
            <EditPermissionHandler roomId={roomId} collaborators={collaborators} />
          </>
        )}
        <AutoSaveHandler
          onSaveStatusChange={setSaveStatus}
          onDrawingLoaded={handleDrawingLoaded}
          roomId={roomId}
          debounceMs={5000}
        />
      </Tldraw>
    </div>
  )
}