import { track, useEditor } from '@tldraw/tldraw'
import { getAnchorsForGeoType } from '../../lib/connectionPoints'

export const ConnectionPoints = track(function ConnectionPoints() {
  const editor = useEditor()
  const shapes = editor.getCurrentPageShapes()

  const geoShapes = shapes.filter(
    (s) => s.type === 'geo' && (s.props as any).geo !== 'ellipse'
  )

  const points: { key: string; screenX: number; screenY: number }[] = []

  for (const shape of geoShapes) {
    const geoType = (shape.props as any).geo as string
    const anchors = getAnchorsForGeoType(geoType)
    if (anchors.length === 0) continue

    const bounds = editor.getShapePageBounds(shape)
    if (!bounds) continue

    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i]
      const pageX = bounds.x + anchor.x * bounds.width
      const pageY = bounds.y + anchor.y * bounds.height
      const screenPos = editor.pageToScreen({ x: pageX, y: pageY })

      points.push({
        key: `${shape.id}-${i}`,
        screenX: screenPos.x,
        screenY: screenPos.y,
      })
    }
  }

  if (points.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 998,
        overflow: 'hidden',
      }}
    >
      {points.map((pt) => (
        <div
          key={pt.key}
          style={{
            position: 'absolute',
            left: pt.screenX - 4,
            top: pt.screenY - 4,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#8b1a1a',
            border: '1px solid rgba(255,255,255,0.6)',
          }}
        />
      ))}
    </div>
  )
})
