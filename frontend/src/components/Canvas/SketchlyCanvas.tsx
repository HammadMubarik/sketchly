import React, { useEffect, useState, useCallback } from 'react'
import { Tldraw, Editor, TLDrawShape, track, useEditor } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { getQuickDrawRecognizer } from '../../utils/quickDrawRecognizer'
import { UserProfile } from '../Auth/UserProfile'

function QuickDrawPanel({ editor }: { editor: Editor }) {
  const [enabled, setEnabled] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.3)

  const recognizer = getQuickDrawRecognizer()

  useEffect(() => {
    const checkReady = setInterval(() => {
      if (recognizer.isReady()) {
        setModelReady(true)
        clearInterval(checkReady)
      }
    }, 500)
    return () => clearInterval(checkReady)
  }, [recognizer])

  const processShape = useCallback(async () => {
    if (!enabled || isProcessing || !modelReady) return
    
    setIsProcessing(true)
    
    try {
      const selectedShapes = editor.getSelectedShapes()
      const drawShapes = selectedShapes.filter(
        (shape): shape is TLDrawShape => shape.type === 'draw'
      )

      if (drawShapes.length === 0) {
        setIsProcessing(false)
        return
      }

      for (const drawShape of drawShapes) {
        const points: Array<{ x: number; y: number }> = []
        
        for (const segment of drawShape.props.segments) {
          for (const point of segment.points) {
            points.push({
              x: point.x + drawShape.x,
              y: point.y + drawShape.y,
            })
          }
        }

        if (points.length < 5) continue

        const prediction = await recognizer.predict(points)

        console.log('Prediction:', {
          shape: prediction.category,
          confidence: `${(prediction.confidence * 100).toFixed(1)}%`,
        })

        if (prediction.confidence >= confidenceThreshold) {
          convertShapeToGeo(editor, drawShape, prediction.category)
        }
      }
    } catch (error) {
      console.error('Recognition error:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [editor, enabled, isProcessing, modelReady, confidenceThreshold, recognizer])

  useEffect(() => {
    if (!enabled || !modelReady) return

    let timeoutId: NodeJS.Timeout

    const handlePointerUp = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        processShape()
      }, 200)
    }

    editor.root.addEventListener('pointerup', handlePointerUp)

    return () => {
      editor.root.removeEventListener('pointerup', handlePointerUp)
      clearTimeout(timeoutId)
    }
  }, [editor, enabled, modelReady, processShape])

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: 'white',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: '280px',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      zIndex: 1000,
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>
        🎨 Quick Draw AI
        {!modelReady && <span style={{ fontSize: '12px', color: '#999' }}> (Loading...)</span>}
      </h3>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={!modelReady}
        />
        <span>{enabled ? '✓ Active' : 'Disabled'}</span>
      </label>

      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
          Confidence: {(confidenceThreshold * 100).toFixed(0)}%
        </label>
        <input
          type="range"
          min="0.2"
          max="0.8"
          step="0.05"
          value={confidenceThreshold}
          onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  )
}

function convertShapeToGeo(editor: Editor, drawShape: TLDrawShape, category: string) {
  const shapeMap: Record<string, string> = {
    'circle': 'oval',
    'square': 'rectangle',
    'rectangle': 'rectangle',
    'triangle': 'triangle',
    'diamond': 'diamond',
    'pentagon': 'pentagon',
    'hexagon': 'hexagon',
    'star': 'star',
    'heart': 'heart-oval',
    'arrow': 'arrow-right',
    'cloud': 'cloud',
    'line': 'line',
  }

  const geoType = shapeMap[category.toLowerCase()] || 'rectangle'
  const bounds = editor.getShapeGeometry(drawShape).bounds
  
  editor.createShape({
    type: 'geo',
    x: drawShape.x,
    y: drawShape.y,
    props: {
      geo: geoType,
      w: Math.max(bounds.width, 50),
      h: Math.max(bounds.height, 50),
      color: drawShape.props.color,
      fill: 'none',
      dash: 'draw',
      size: drawShape.props.size,
    },
  })

  editor.deleteShape(drawShape.id)
}

const TrackedQuickDrawPanel = track(function TrackedPanel() {
  const editor = useEditor()
  return <QuickDrawPanel editor={editor} />
})

export default function SketchlyCanvas() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
     <UserProfile />
      <Tldraw>
        <TrackedQuickDrawPanel />
      </Tldraw>
    </div>
  )
}