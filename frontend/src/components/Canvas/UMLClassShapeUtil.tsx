import { BaseBoxShapeUtil, HTMLContainer, T, useEditor } from '@tldraw/tldraw'
import type { TLBaseShape } from '@tldraw/tldraw'
import { useRef, useCallback, useLayoutEffect, useEffect } from 'react'

export type UMLClassShapeProps = {
  w: number
  h: number
  topText: string
  middleText: string
  bottomText: string
}

export type UMLClassShape = TLBaseShape<'uml-class', UMLClassShapeProps>

const MIN_SECTION_H = 48

const stopProp = (e: React.SyntheticEvent) => e.stopPropagation()

function UMLClassComponent({ shape }: { shape: UMLClassShape }) {
  const editor = useEditor()
  const topRef = useRef<HTMLTextAreaElement>(null)
  const midRef = useRef<HTMLTextAreaElement>(null)
  const botRef = useRef<HTMLTextAreaElement>(null)
  const topCursor = useRef<{ start: number; end: number } | null>(null)
  const midCursor = useRef<{ start: number; end: number } | null>(null)
  const botCursor = useRef<{ start: number; end: number } | null>(null)

  // Cursor restoration — pure DOM, no state update, safe to run every render
  useLayoutEffect(() => {
    if (topCursor.current && topRef.current) {
      topRef.current.setSelectionRange(topCursor.current.start, topCursor.current.end)
      topCursor.current = null
    }
    if (midCursor.current && midRef.current) {
      midRef.current.setSelectionRange(midCursor.current.start, midCursor.current.end)
      midCursor.current = null
    }
    if (botCursor.current && botRef.current) {
      botRef.current.setSelectionRange(botCursor.current.start, botCursor.current.end)
      botCursor.current = null
    }
  })

  // Auto-size on text change (initial load + Y.js sync). Runs only when text changes, not on height changes, so no infinite loop.
  useEffect(() => {
    if (!topRef.current || !midRef.current || !botRef.current) return
    topRef.current.style.height = 'auto'
    midRef.current.style.height = 'auto'
    botRef.current.style.height = 'auto'
    const topH = Math.max(MIN_SECTION_H, topRef.current.scrollHeight)
    const midH = Math.max(MIN_SECTION_H, midRef.current.scrollHeight)
    const botH = Math.max(MIN_SECTION_H, botRef.current.scrollHeight)
    topRef.current.style.height = topH + 'px'
    midRef.current.style.height = midH + 'px'
    botRef.current.style.height = botH + 'px'
    const totalH = topH + midH + botH
    if (Math.abs(totalH - shape.props.h) > 1) {
      editor.updateShape<UMLClassShape>({
        id: shape.id,
        type: 'uml-class',
        props: { ...shape.props, h: totalH },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape.props.topText, shape.props.middleText, shape.props.bottomText])

  const handleChange = useCallback(
    (field: 'topText' | 'middleText' | 'bottomText', value: string, changedEl: HTMLTextAreaElement) => {
      changedEl.style.height = 'auto'
      const topH = Math.max(MIN_SECTION_H, topRef.current?.scrollHeight ?? MIN_SECTION_H)
      const midH = Math.max(MIN_SECTION_H, midRef.current?.scrollHeight ?? MIN_SECTION_H)
      const botH = Math.max(MIN_SECTION_H, botRef.current?.scrollHeight ?? MIN_SECTION_H)
      changedEl.style.height = (field === 'topText' ? topH : field === 'middleText' ? midH : botH) + 'px'
      editor.updateShape<UMLClassShape>({
        id: shape.id,
        type: 'uml-class',
        props: { ...shape.props, [field]: value, h: topH + midH + botH },
      })
    },
    [editor, shape]
  )

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    resize: 'none',
    overflow: 'hidden',
    border: 'none',
    outline: 'none',
    padding: '8px 10px',
    fontFamily: 'inherit',
    fontSize: 13,
    background: 'transparent',
    boxSizing: 'border-box',
    minHeight: MIN_SECTION_H,
    lineHeight: '1.5',
    display: 'block',
  }

  return (
    <HTMLContainer style={{ pointerEvents: 'all' }}>
      <div
        style={{
          width: shape.props.w,
          height: shape.props.h,
          border: '2px solid #1a1a1a',
          borderRadius: 4,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <textarea
          ref={topRef}
          value={shape.props.topText}
          placeholder="Class name"
          style={{
            ...textareaStyle,
            borderBottom: '1.5px solid #1a1a1a',
            fontWeight: 600,
            textAlign: 'center',
          }}
          onChange={e => {
            topCursor.current = { start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0 }
            handleChange('topText', e.target.value, e.target)
          }}
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onMouseDown={stopProp}
          onKeyDown={stopProp}
          onKeyUp={stopProp}
          onPaste={stopProp}
        />
        <textarea
          ref={midRef}
          value={shape.props.middleText}
          placeholder="Attributes"
          style={{ ...textareaStyle, borderBottom: '1.5px solid #1a1a1a' }}
          onChange={e => {
            midCursor.current = { start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0 }
            handleChange('middleText', e.target.value, e.target)
          }}
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onMouseDown={stopProp}
          onKeyDown={stopProp}
          onKeyUp={stopProp}
          onPaste={stopProp}
        />
        <textarea
          ref={botRef}
          value={shape.props.bottomText}
          placeholder="Methods"
          style={{ ...textareaStyle, flex: 1 }}
          onChange={e => {
            botCursor.current = { start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0 }
            handleChange('bottomText', e.target.value, e.target)
          }}
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onMouseDown={stopProp}
          onKeyDown={stopProp}
          onKeyUp={stopProp}
          onPaste={stopProp}
        />
      </div>
    </HTMLContainer>
  )
}

export class UMLClassShapeUtil extends BaseBoxShapeUtil<UMLClassShape> {
  static override type = 'uml-class' as const

  static override props = {
    w: T.number,
    h: T.number,
    topText: T.string,
    middleText: T.string,
    bottomText: T.string,
  }

  getDefaultProps(): UMLClassShapeProps {
    return {
      w: 200,
      h: MIN_SECTION_H * 3,
      topText: '',
      middleText: '',
      bottomText: '',
    }
  }

  component(shape: UMLClassShape) {
    return <UMLClassComponent shape={shape} />
  }

  indicator(shape: UMLClassShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
