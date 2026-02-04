import { track, useEditor } from '@tldraw/tldraw'
import type { Collaborator } from './YjsSyncBridge'

interface CollaboratorCursorsProps {
  collaborators: Collaborator[]
}

export const CollaboratorCursors = track(function CollaboratorCursors({
  collaborators,
}: CollaboratorCursorsProps) {
  const editor = useEditor()
  const currentPageId = editor.getCurrentPageId()

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      {collaborators
        .filter((c) => c.cursor && c.cursor.pageId === currentPageId)
        .map((collaborator) => {
          const screenPos = editor.pageToScreen({
            x: collaborator.cursor!.x,
            y: collaborator.cursor!.y,
          })

          return (
            <div
              key={collaborator.id}
              style={{
                position: 'absolute',
                left: screenPos.x,
                top: screenPos.y,
                transform: 'translate(-2px, -2px)',
                transition: 'left 0.05s, top 0.05s',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path
                  d="M5.5 3L19 12L12 13L9 20L5.5 3Z"
                  fill={collaborator.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '16px',
                  background: collaborator.color,
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              >
                {collaborator.name}
              </span>
            </div>
          )
        })}
    </div>
  )
})
