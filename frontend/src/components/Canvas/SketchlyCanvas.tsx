import { Tldraw, track, useEditor, createShapeId, type Editor } from '@tldraw/tldraw'
import type { TLShapeId } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { cnnRecognizer } from '../../lib/cnnRecognizer'
import type { Point } from '../../lib/cnnRecognizer'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
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
import { getAnchorsForGeoType, getExternalAnchors, type ConnectionAnchor } from '../../lib/connectionPoints'
import { UMLClassShapeUtil } from './UMLClassShapeUtil'
import { JavaCodeModal } from './JavaCodeModal'
import { findOrthogonalPath, type Obstacle } from '../../lib/pathfinder'

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
        // Tldraw v4 reserves bottom-right for its watermark and degrades the
        // whole UI if the watermark is obscured. Anchor to top-right instead.
        top: '1rem',
        right: '7rem',
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
  const processingRef = useRef(false)
  const pendingRef = useRef(false)

  useEffect(() => {
    // Delete any stale draw shapes left over from previous sessions.
    // These are unconverted hand-drawn strokes that would otherwise be
    // mis-processed when the user draws new shapes.
    const staleDrawShapes = editor.getCurrentPageShapes().filter(s => s.type === 'draw')
    if (staleDrawShapes.length > 0) {
      editor.deleteShapes(staleDrawShapes.map(s => s.id))
    }

    // Track every shape ID that has been processed this session so we
    // never accidentally re-process or skip the newest shape.
    const processedIds = new Set<TLShapeId>()
    // Count attempts per shape so we give up after a few failed recognitions
    // instead of retrying forever.
    const attemptCount = new Map<TLShapeId, number>()

    const handlePointerUp = () => {
      if (pendingRef.current) return  // already a recognition queued, skip duplicate
      pendingRef.current = true
      // Small delay to let tldraw finish creating the shape
      setTimeout(() => {
        pendingRef.current = false
        if (processingRef.current) return
        processingRef.current = true

        ;(async () => {
          try {
            const allShapes = editor.getCurrentPageShapes()
            const drawShapes = allShapes.filter(s => s.type === 'draw')

            if (drawShapes.length === 0) return

            // Pick the newest unprocessed draw shape (tldraw fractional index
            // is lexicographically ordered by creation time).
            const unprocessed = drawShapes.filter(s => !processedIds.has(s.id))
            if (unprocessed.length === 0) return
            const latestShape = unprocessed.reduce((a: any, b: any) =>
              a.index > b.index ? a : b
            )

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

            if (points.length < 10) return

            let result = { name: 'unknown', confidence: 0 }
            const threshold = 0.55

            // Run CNN recognizer
            try {
              const cnnResult = await Promise.race([
                cnnRecognizer.recognize(points),
                new Promise<never>((_, rej) =>
                  setTimeout(() => rej(new Error('CNN timeout')), 10_000)
                ),
              ])
              if (cnnResult.confidence > threshold) {
                result = cnnResult
              } else if (cnnResult.name === 'line' && cnnResult.confidence > 0.25) {
                // Lines drawn between shapes are often curved/imprecise — accept at lower threshold
                result = cnnResult
              }
            } catch (cnnError) {
              console.error('CNN recognition failed:', cnnError)
            }

            // Always run geometric corner analysis — used to correct CNN mistakes.
            {
              const stride = Math.max(1, Math.floor(points.length / 40))
              const subs: Point[] = []
              for (let i = 0; i < points.length; i += stride) subs.push(points[i])
              const WIN = 4
              let corners = 0
              let lastCorner = -WIN * 4
              for (let i = WIN; i < subs.length - WIN; i++) {
                const dx1 = subs[i].x - subs[i - WIN].x
                const dy1 = subs[i].y - subs[i - WIN].y
                const dx2 = subs[i + WIN].x - subs[i].x
                const dy2 = subs[i + WIN].y - subs[i].y
                const len1 = Math.hypot(dx1, dy1)
                const len2 = Math.hypot(dx2, dy2)
                if (len1 < 2 || len2 < 2) continue
                const cos = (dx1 * dx2 + dy1 * dy2) / (len1 * len2)
                const angle = Math.acos(Math.max(-1, Math.min(1, cos)))
                if (angle > Math.PI * 0.28 && i - lastCorner > WIN * 2) {
                  corners++
                  lastCorner = i
                }
              }
              const xs = points.map(p => p.x)
              const ys = points.map(p => p.y)
              const geoW = Math.max(...xs) - Math.min(...xs)
              const geoH = Math.max(...ys) - Math.min(...ys)
              const aspect = geoW / Math.max(geoH, 1)

              // tldraw marks a draw shape isClosed when the endpoint is very
              // near the start.  Also detect "nearly closes" spatially because
              // tldraw's threshold is strict — a 4-side square drawn without
              // precisely returning to the start pixel is still a closed shape.
              const firstPt = points[0]
              const lastPt  = points[points.length - 1]
              const closeGap = Math.hypot(firstPt.x - lastPt.x, firstPt.y - lastPt.y)
              const shapeSize = Math.max(geoW, geoH)
              const strokeNearlyCloses = shapeProps.isClosed || closeGap < shapeSize * 0.3

              // The closing segment of a closed stroke adds one more direction
              // change that is NOT in the points array — compensate for it.
              if (strokeNearlyCloses) corners++

              if (corners >= 4) {
                // 4+ corners → rectangle/square
                if (result.confidence < 0.78 || result.name === 'triangle' || result.name === 'unknown') {
                  const corrected = aspect > 1.4 ? 'rectangle' : 'square'
                  result = { ...result, name: corrected, confidence: 0.72 }
                }
              } else if (corners === 3) {
                if (result.name === 'unknown') {
                  // 3 corners with unknown CNN result: use aspect ratio and
                  // closing behaviour to distinguish a square traced as 4 sides
                  // from a genuine triangle.
                  if (strokeNearlyCloses && aspect > 0.5 && aspect < 2.0) {
                    const corrected = aspect > 1.4 ? 'rectangle' : 'square'
                    result = { ...result, name: corrected, confidence: 0.68 }
                  } else {
                    result = { ...result, name: 'triangle', confidence: 0.72 }
                  }
                } else if ((result.name === 'square' || result.name === 'rectangle') && result.confidence < threshold) {
                  // CNN weakly voted square/rectangle and geometry agrees — bump over threshold
                  result = { ...result, confidence: threshold + 0.01 }
                }
              } else if (corners <= 2 && result.confidence < 0.78) {
                // Very few corners and CNN uncertain — correct open rectangle/
                // square strokes to triangle (they were probably drawn as a
                // U-shape or L-shape, not a closed box).
                if (!strokeNearlyCloses && (result.name === 'rectangle' || result.name === 'square')) {
                  result = { ...result, name: 'triangle', confidence: 0.72 }
                }
              }
            }

            const effectiveThreshold = result.name === 'line' ? 0.25 : threshold
            if (result.confidence <= effectiveThreshold || result.name === 'unknown') {
              // Recognition failed.  Track attempts and give up after 3 so we
              // don't retry forever.  Between attempts, schedule an automatic
              // re-run so the user doesn't have to switch tools to trigger it.
              const attempts = (attemptCount.get(latestShape.id) ?? 0) + 1
              attemptCount.set(latestShape.id, attempts)
              if (attempts >= 3) {
                processedIds.add(latestShape.id) // give up permanently
              } else {
                // Auto-retry: processingRef is released in the finally block
                // below, so this setTimeout fires into a clear processing state.
                setTimeout(() => {
                  if (!processedIds.has(latestShape.id)) {
                    pendingRef.current = false
                    handlePointerUp()
                  }
                }, 500)
              }
              return
            }

            const bounds = editor.getShapePageBounds(latestShape)
            if (!bounds) return

            const centerX = bounds.x + bounds.width / 2
            const centerY = bounds.y + bounds.height / 2
            const size = Math.max(Math.min(bounds.width, bounds.height), 40)

            // Shared snap logic for arrows and lines
            const allPageShapes = editor.getCurrentPageShapes()
            const geoShapes = allPageShapes.filter(s => s.type === 'geo' || s.type === 'uml-class')
            // Zoom-aware snap distance: 80 screen pixels converted to page coordinates
            const zoom = editor.getZoomLevel()
            const SNAP_DISTANCE = 80 / zoom

            const findNearestSnap = (point: Point, otherPoint?: Point, allowInternal = false) => {
              let bestShape: typeof geoShapes[0] | null = null
              let bestAnchor: ConnectionAnchor = { x: 0.5, y: 0.5 }
              let bestPagePos = { x: 0, y: 0 }
              let minDistance = SNAP_DISTANCE

              for (const shape of geoShapes) {
                if (shape.id === latestShape.id) continue
                const shapeBounds = editor.getShapePageBounds(shape)
                if (!shapeBounds) continue

                const anchors = shape.type === 'uml-class'
                  ? getExternalAnchors()
                  : getAnchorsForGeoType((shape.props as any).geo as string)
                const pts = anchors.length > 0 ? anchors : [{ x: 0.5, y: 0.5 }]

                const pointInsideShape = (p: Point) =>
                  p.x >= shapeBounds.x &&
                  p.x <= shapeBounds.x + shapeBounds.width &&
                  p.y >= shapeBounds.y &&
                  p.y <= shapeBounds.y + shapeBounds.height

                for (const anchor of pts) {
                  if (anchor.internalOnly) {
                    // Internal anchors: only for lines where the other endpoint is inside this shape
                    if (!allowInternal) continue
                    if (!otherPoint || !pointInsideShape(otherPoint)) continue
                  } else {
                    // Regular anchors: skip entirely when the current point is inside the shape
                    // (prevents internal lines from snapping to external midpoints)
                    if (allowInternal && pointInsideShape(point)) continue
                  }

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
                    type: 'uml-class',
                    x: bounds.x,
                    y: bounds.y,
                    props: { w: bounds.width, h: bounds.height, topText: '', middleText: '', bottomText: '' },
                  }])
                  break
                }
                case 'square': {
                  const id = createShapeId()
                  newGeoShapeId = id
                  editor.createShapes([{
                    id,
                    type: 'uml-class',
                    x: centerX - size / 2,
                    y: centerY - size / 2,
                    props: { w: size, h: size, topText: '', middleText: '', bottomText: '' },
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
                      dash: 'dotted',
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

                  const lineStartSnap = findNearestSnap(first, last, true)
                  const lineEndSnap = findNearestSnap(last, first, true)

                  // If both endpoints snapped to internalOnly anchors on the same shape,
                  // create ALL internal divider lines at once (UML compartment behavior)
                  const isInternalLine =
                    lineStartSnap?.anchor.internalOnly &&
                    lineEndSnap?.anchor.internalOnly &&
                    lineStartSnap.shape.id === lineEndSnap.shape.id

                  if (isInternalLine && lineStartSnap && lineEndSnap) {
                    const targetShape = lineStartSnap.shape
                    const targetBounds = editor.getShapePageBounds(targetShape)
                    if (targetBounds) {
                      const allAnchors = getAnchorsForGeoType((targetShape.props as any).geo as string)
                      const internalYValues = [...new Set(allAnchors.filter(a => a.internalOnly).map(a => a.y))]

                      for (const yVal of internalYValues) {
                        const dividerLineId = createShapeId()
                        editor.createShapes([{
                          id: dividerLineId,
                          type: 'arrow',
                          x: targetBounds.x,
                          y: targetBounds.y + yVal * targetBounds.height,
                          props: {
                            start: { x: 0, y: 0 },
                            end: { x: targetBounds.width, y: 0 },
                            arrowheadStart: 'none',
                            arrowheadEnd: 'none',
                          },
                        }])
                        try {
                          editor.createBinding({
                            type: 'arrow', fromId: dividerLineId, toId: targetShape.id,
                            props: { terminal: 'start', normalizedAnchor: { x: 0, y: yVal }, isExact: false, isPrecise: true },
                          })
                        } catch (e) { console.warn('Failed to bind divider start:', e) }
                        try {
                          editor.createBinding({
                            type: 'arrow', fromId: dividerLineId, toId: targetShape.id,
                            props: { terminal: 'end', normalizedAnchor: { x: 1, y: yVal }, isExact: false, isPrecise: true },
                          })
                        } catch (e) { console.warn('Failed to bind divider end:', e) }
                      }
                    }
                  } else {
                    // Build obstacles: every shape is a full obstacle. The pathfinder
                    // punches narrow doorways at the start/end anchors using startDir/
                    // endDir, so endpoint shapes don't need a padding override.
                    const lineObstacles: Obstacle[] = geoShapes
                      .filter(s => s.id !== latestShape.id)
                      .flatMap(s => {
                        const b = editor.getShapePageBounds(s)
                        if (!b) return []
                        return [{ x: b.x, y: b.y, width: b.width, height: b.height }]
                      })

                    const routeStart = lineStartSnap
                      ? { x: lineStartSnap.pagePos.x, y: lineStartSnap.pagePos.y }
                      : { x: first.x, y: first.y }
                    const routeEnd = lineEndSnap
                      ? { x: lineEndSnap.pagePos.x, y: lineEndSnap.pagePos.y }
                      : { x: last.x, y: last.y }

                    // Outward direction at a side-midpoint anchor (normalized 0–1).
                    // Returns null for interior anchors (e.g. UML compartment dividers).
                    const outwardDir = (a: { x: number; y: number }): [number, number] | null => {
                      if (a.x <= 0.001) return [-1, 0]
                      if (a.x >= 0.999) return [1, 0]
                      if (a.y <= 0.001) return [0, -1]
                      if (a.y >= 0.999) return [0, 1]
                      return null
                    }
                    const startOut = lineStartSnap ? outwardDir(lineStartSnap.anchor) : null
                    const endOut = lineEndSnap ? outwardDir(lineEndSnap.anchor) : null
                    const route = findOrthogonalPath(routeStart, routeEnd, lineObstacles, {
                      startDir: startOut ?? undefined,
                      // arrival direction is opposite of the end-anchor's outward normal
                      endDir: endOut ? [-endOut[0], -endOut[1]] : undefined,
                    })

                    // Position the line shape at the first waypoint; all points are relative to it
                    const ox = route[0].x, oy = route[0].y
                    editor.createShapes([{
                      id: createShapeId(),
                      type: 'line',
                      x: ox,
                      y: oy,
                      props: {
                        points: route.map((pt, i) => ({
                          id: createShapeId(),
                          index: `a${i + 1}` as any,
                          x: pt.x - ox,
                          y: pt.y - oy,
                        })),
                        dash: 'dotted',
                        color: (latestShape.props && (latestShape.props as any).color) || undefined,
                        size: (latestShape.props && (latestShape.props as any).size) || undefined,
                      },
                    }])
                  }
                  break
                }
                default:
                  return
              }

              // Mark as processed only now that we're about to delete the draw
              // shape and replace it — prevents the tool-change retry from
              // double-converting a shape that was already handled.
              processedIds.add(latestShape.id)
              editor.deleteShapes([latestShape.id])

              // Auto-snap: if a new geo shape was created, check if any of its
              // connection points are near connection points of existing shapes.
              // If so, reposition the new shape so they touch exactly.
              if (newGeoShapeId) {
                const newShape = editor.getShape(newGeoShapeId)
                if (newShape) {
                  const newBounds = editor.getShapePageBounds(newShape)
                  const newAnchors = newShape.type === 'uml-class'
                    ? getExternalAnchors()
                    : getAnchorsForGeoType((newShape.props as any).geo as string)

                  if (newBounds && newAnchors.length > 0) {
                    const existingGeoShapes = editor.getCurrentPageShapes()
                      .filter(s => (s.type === 'geo' || s.type === 'uml-class') && s.id !== newGeoShapeId)

                    const AUTO_SNAP_DISTANCE = 60 / zoom

                    // Find the closest pair of connection points between the new shape and any existing shape
                    let bestMatch: { newAnchor: { x: number; y: number }; otherPx: number; otherPy: number; newPx: number; newPy: number; dist: number } | null = null

                    for (const newAnchor of newAnchors) {
                      const newPx = newBounds.x + newAnchor.x * newBounds.width
                      const newPy = newBounds.y + newAnchor.y * newBounds.height

                      for (const other of existingGeoShapes) {
                        const otherBounds = editor.getShapePageBounds(other)
                        if (!otherBounds) continue
                        const otherAnchors = other.type === 'uml-class'
                          ? getExternalAnchors()
                          : getAnchorsForGeoType((other.props as any).geo as string)
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
                        type: newShape.type as any,
                        x: newShape.x + dx,
                        y: newShape.y + dy,
                      })
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

    // Listen for pointerup anywhere on the window.
    // We do NOT gate on getCurrentToolId() === 'draw' because tldraw often switches
    // the tool back to select synchronously before the window listener fires, causing
    // the check to fail and leaving shapes un-converted. The early-exit guards inside
    // handlePointerUp (drawShapes.length === 0, processedIds, pendingRef) are
    // sufficient to prevent false triggers.
    const onWindowPointerUp = () => {
      handlePointerUp()
    }

    window.addEventListener('pointerup', onWindowPointerUp)

    // Backup: also trigger when the tool explicitly leaves draw mode
    // (covers edge cases where pointerup fires but the draw shape isn't committed yet)
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
  const [javaCode, setJavaCode] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const editorRef = useRef<Editor | null>(null)

  console.log('[SketchlyCanvas] render, roomId:', roomId)
  useEffect(() => {
    console.log('[SketchlyCanvas] MOUNTED')
    return () => console.log('[SketchlyCanvas] UNMOUNTED')
  }, [])
  useEffect(() => {
    console.log('[SketchlyCanvas] roomId changed to:', roomId)
  }, [roomId])

  // Stabilise the props passed to <Tldraw>. New array/function references on
  // every parent re-render cause tldraw to treat its config as having changed
  // and tear down child components — that was unmounting YjsSyncBridge.
  const tldrawShapeUtils = useMemo(() => [UMLClassShapeUtil], [])
  const handleTldrawMount = useCallback((editor: Editor) => {
    editorRef.current = editor
  }, [])

  const handleGenerateJava = async () => {
    const editor = editorRef.current
    if (!editor) return
    setGenerating(true)
    try {
      const shapeIds = Array.from(editor.getCurrentPageShapeIds())

      // Export SVG with 15s timeout
      const svgString = await Promise.race([
        editor.getSvgString(shapeIds),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('SVG export timed out after 15s')), 15000)
        ),
      ])
      if (!svgString) throw new Error('Could not export canvas')

      // Convert SVG → PNG base64 with 10s timeout
      // Use a base64 data URL (not blob URL) to avoid browser SVG security restrictions
      const base64 = await Promise.race([
        new Promise<string>((resolve, reject) => {
          const img = new Image()
          const svgEncoded = btoa(new TextDecoder('latin1').decode(new TextEncoder().encode(svgString.svg)))
          img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = svgString.width
            canvas.height = svgString.height
            const ctx = canvas.getContext('2d')!
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)
            const dataUrl = canvas.toDataURL('image/png')
            resolve(dataUrl.split(',')[1])
          }
          img.onerror = reject
          img.src = `data:image/svg+xml;base64,${svgEncoded}`
        }),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('SVG→PNG conversion timed out after 10s')), 10000)
        ),
      ])

      const apiBase = import.meta.env.VITE_BACKEND_URL ?? ''
      const resp = await fetch(`${apiBase}/api/generate-java`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setJavaCode(`Backend error (${resp.status}): ${data.error ?? 'unknown'}`)
        return
      }
      setJavaCode(data.code || 'No code returned (Claude returned empty response).')
    } catch (err) {
      console.error('generate-java error', err)
      setJavaCode(`Error: ${err instanceof Error ? err.message : 'Check the console.'}`)
    } finally {
      setGenerating(false)
    }
  }

  // Parse room ID from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRoomId = params.get('room')
    if (urlRoomId) {
      setRoomId(urlRoomId)
    }
  }, [])

  // Record room visit whenever roomId is established.
  useEffect(() => {
    if (!roomId || !user?.id) return
    const roomName = `Room ${roomId.slice(0, 8)}`
    recordRoomVisit(user.id, roomId, roomName)
  }, [roomId, user?.id])

  // When drawing is saved/loaded, sync roomId to the real Supabase drawing ID.
  // Always update so that the first auto-save replaces the temporary UUID we
  // put in the URL at room-creation time with the actual drawing ID — this
  // lets recordRoomVisit (which fires on roomId change) succeed with a valid
  // foreign key instead of failing against a not-yet-existing drawings row.
  const handleDrawingLoaded = (drawingId: string) => {
    if (roomId !== drawingId) {
      setRoomId(drawingId)
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
      <button
        onClick={handleGenerateJava}
        disabled={generating}
        style={{
          position: 'fixed',
          // Anchored top-right (next to Share). Tldraw v4 owns the bottom-right
          // for its watermark and disables the whole UI if it's covered.
          top: '4rem',
          right: '1rem',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: generating ? '#6b7280' : '#3b82f6',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          border: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: generating ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        {generating ? 'Generating...' : '⚡ Generate Java'}
      </button>
      {javaCode && <JavaCodeModal code={javaCode} onClose={() => setJavaCode(null)} />}
      <Tldraw shapeUtils={tldrawShapeUtils} onMount={handleTldrawMount}>
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