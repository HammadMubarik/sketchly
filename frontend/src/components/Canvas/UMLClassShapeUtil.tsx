import { BaseBoxShapeUtil, HTMLContainer, T, useEditor } from '@tldraw/tldraw'
import type { TLBaseShape } from '@tldraw/tldraw'
import { useRef, useCallback } from 'react'

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

  const handleChange = useCallback(
    (field: 'topText' | 'middleText' | 'bottomText', value: string) => {
      // Measure heights after the DOM has updated
      requestAnimationFrame(() => {
        const topH = Math.max(MIN_SECTION_H, topRef.current?.scrollHeight ?? MIN_SECTION_H)
        const midH = Math.max(MIN_SECTION_H, midRef.current?.scrollHeight ?? MIN_SECTION_H)
        const botH = Math.max(MIN_SECTION_H, botRef.current?.scrollHeight ?? MIN_SECTION_H)
        editor.updateShape<UMLClassShape>({
          id: shape.id,
          type: 'uml-class',
          props: { ...shape.props, [field]: value, h: topH + midH + botH },
        })
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
            const el = e.target
            el.style.height = 'auto'
            el.style.height = el.scrollHeight + 'px'
            handleChange('topText', e.target.value)
          }}
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onMouseDown={stopProp}
          onKeyDown={stopProp}
          onKeyUp={stopProp}
        />
        <textarea
          ref={midRef}
          value={shape.props.middleText}
          placeholder="Attributes"
          style={{ ...textareaStyle, borderBottom: '1.5px solid #1a1a1a' }}
          onChange={e => {
            const el = e.target
            el.style.height = 'auto'
            el.style.height = el.scrollHeight + 'px'
            handleChange('middleText', e.target.value)
          }}
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onMouseDown={stopProp}
          onKeyDown={stopProp}
          onKeyUp={stopProp}
        />
        <textarea
          ref={botRef}
          value={shape.props.bottomText}
          placeholder="Methods"
          style={{ ...textareaStyle, flex: 1 }}
          onChange={e => {
            const el = e.target
            el.style.height = 'auto'
            el.style.height = el.scrollHeight + 'px'
            handleChange('bottomText', e.target.value)
          }}
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onMouseDown={stopProp}
          onKeyDown={stopProp}
          onKeyUp={stopProp}
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
